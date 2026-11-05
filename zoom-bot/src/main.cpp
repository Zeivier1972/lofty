// Sofía — native Zoom Meeting SDK bot (Linux, headless).
//
// Joins one meeting as a participant, reports every chat message as a JSON
// line on stdout, and sends the chat messages it receives on stdin:
//   SEND\t<to>\t<base64 utf-8 text>   to = 0 (everyone) | host | <userId>
//   LEAVE
// The control server (server.mjs) decides what to answer. Config comes from
// env: ZOOM_SDK_KEY, ZOOM_SDK_SECRET, MEETING_NUMBER, MEETING_PASSWORD,
// DISPLAY_NAME.

#include <glib.h>
#include <unistd.h>
#include <csignal>
#include <cstdio>
#include <cstdlib>
#include <ctime>
#include <iostream>
#include <map>
#include <sstream>
#include <string>
#include <vector>

#include <openssl/evp.h>
#include <openssl/hmac.h>

#include "zoom_sdk.h"
#include "auth_service_interface.h"
#include "meeting_service_interface.h"
#include "meeting_service_components/meeting_chat_interface.h"
#include "meeting_service_components/meeting_participants_ctrl_interface.h"
#include "meeting_service_components/meeting_audio_interface.h"

using namespace std;
using namespace ZOOMSDK;

// ---------------------------------------------------------------- helpers

static string env(const char* k, const char* d = "") {
  const char* v = getenv(k);
  return v ? string(v) : string(d);
}

static string jsonEscape(const string& s) {
  string o;
  o.reserve(s.size() + 8);
  for (unsigned char c : s) {
    switch (c) {
      case '"': o += "\\\""; break;
      case '\\': o += "\\\\"; break;
      case '\n': o += "\\n"; break;
      case '\r': o += "\\r"; break;
      case '\t': o += "\\t"; break;
      default:
        if (c < 0x20) { char b[8]; snprintf(b, sizeof b, "\\u%04x", c); o += b; }
        else o += (char)c;
    }
  }
  return o;
}

static void emit(const string& json) {
  cout << json << endl;  // endl flushes: the control server reads line by line
}

static void status(const string& st, const string& detail = "") {
  emit("{\"type\":\"status\",\"status\":\"" + st + "\",\"detail\":\"" + jsonEscape(detail) + "\"}");
}

static void logLine(const string& text) {
  emit("{\"type\":\"log\",\"text\":\"" + jsonEscape(text) + "\"}");
}

static string b64url(const unsigned char* data, size_t len) {
  static const char* t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  string o;
  size_t i = 0;
  while (i + 2 < len) {
    unsigned v = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    o += t[(v >> 18) & 63]; o += t[(v >> 12) & 63]; o += t[(v >> 6) & 63]; o += t[v & 63];
    i += 3;
  }
  if (len - i == 1) {
    unsigned v = data[i] << 16;
    o += t[(v >> 18) & 63]; o += t[(v >> 12) & 63];
  } else if (len - i == 2) {
    unsigned v = (data[i] << 16) | (data[i + 1] << 8);
    o += t[(v >> 18) & 63]; o += t[(v >> 12) & 63]; o += t[(v >> 6) & 63];
  }
  return o;
}

static string b64url(const string& s) { return b64url((const unsigned char*)s.data(), s.size()); }

static string b64decode(const string& in) {
  string out;
  vector<int> T(256, -1);
  const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (int i = 0; i < 64; i++) T[(unsigned char)chars[i]] = i;
  T['-'] = 62; T['_'] = 63;
  int val = 0, bits = -8;
  for (unsigned char c : in) {
    if (T[c] == -1) continue;
    val = (val << 6) + T[c];
    bits += 6;
    if (bits >= 0) { out.push_back(char((val >> bits) & 0xFF)); bits -= 8; }
  }
  return out;
}

// Meeting SDK JWT (HS256): appKey + tokenExp, as Zoom's headless sample does.
static string makeJwt(const string& key, const string& secret) {
  time_t iat = time(nullptr) - 30;
  time_t exp = iat + 60 * 60 * 6;
  string header = b64url("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
  stringstream p;
  p << "{\"appKey\":\"" << key << "\",\"sdkKey\":\"" << key << "\",\"iat\":" << iat
    << ",\"exp\":" << exp << ",\"tokenExp\":" << exp << "}";
  string unsignedTok = header + "." + b64url(p.str());
  unsigned char mac[EVP_MAX_MD_SIZE];
  unsigned int macLen = 0;
  HMAC(EVP_sha256(), secret.data(), (int)secret.size(),
       (const unsigned char*)unsignedTok.data(), unsignedTok.size(), mac, &macLen);
  return unsignedTok + "." + b64url(mac, macLen);
}

// ---------------------------------------------------------------- state

static IAuthService* gAuth = nullptr;
static IMeetingService* gMeeting = nullptr;
static GMainLoop* gLoop = nullptr;
static unsigned int gSelfId = 0;
static unsigned int gHostId = 0;
static bool gChatReady = false;
static string gJwt, gMeetingNumber, gPassword, gDisplayName;

static void quit(int code) {
  if (gLoop) g_main_loop_quit(gLoop);
  fflush(stdout);
  _exit(code);
}

static IMeetingParticipantsController* participants() {
  return gMeeting ? gMeeting->GetMeetingParticipantsController() : nullptr;
}

static string userName(unsigned int id) {
  auto* p = participants();
  if (!p) return "";
  IUserInfo* u = p->GetUserByUserID(id);
  if (!u || !u->GetUserName()) return "";
  return u->GetUserName();
}

static void findHost() {
  auto* p = participants();
  if (!p) return;
  IList<unsigned int>* list = p->GetParticipantsList();
  if (!list) return;
  for (int i = 0; i < list->GetCount(); i++) {
    IUserInfo* u = p->GetUserByUserID(list->GetItem(i));
    if (!u) continue;
    if (u->IsMySelf()) gSelfId = u->GetUserID();
    if (u->IsHost()) gHostId = u->GetUserID();
    emit("{\"type\":\"user\",\"joined\":true,\"userId\":" + to_string(u->GetUserID()) +
         ",\"name\":\"" + jsonEscape(u->GetUserName() ? u->GetUserName() : "") + "\"}");
  }
}

static SDKError sendChat(unsigned int to, const string& text) {
  if (!gMeeting) return SDKERR_UNINITIALIZE;
  IMeetingChatController* chat = gMeeting->GetMeetingChatController();
  if (!chat) return SDKERR_UNINITIALIZE;
  IChatMsgInfoBuilder* b = chat->GetChatMessageBuilder();
  if (!b) return SDKERR_UNINITIALIZE;
  b->Clear();
  b->SetContent(text.c_str());
  if (to == 0) {
    b->SetMessageType(SDKChatMessageType_To_All);
  } else {
    b->SetReceiver(to);
    b->SetMessageType(SDKChatMessageType_To_Individual);
  }
  IChatMsgInfo* msg = b->Build();
  if (!msg) return SDKERR_INVALID_PARAMETER;
  return chat->SendChatMsgTo(msg);
}

// ---------------------------------------------------------------- events

class ChatEvent : public IMeetingChatCtrlEvent {
 public:
  void onChatMsgNotification(IChatMsgInfo* m, const zchar_t* content = nullptr) {
    if (!m) return;
    unsigned int from = m->GetSenderUserId();
    if (from == gSelfId && gSelfId != 0) return;  // our own messages echo back
    string text = m->GetContent() ? m->GetContent() : (content ? content : "");
    string name = m->GetSenderDisplayName() ? m->GetSenderDisplayName() : "";
    bool toAll = m->IsChatToAll() || m->GetChatMessageType() == SDKChatMessageType_To_All;
    emit("{\"type\":\"chat\",\"msgId\":\"" + jsonEscape(m->GetMessageID() ? m->GetMessageID() : "") +
         "\",\"senderId\":" + to_string(from) + ",\"senderName\":\"" + jsonEscape(name) +
         "\",\"toAll\":" + (toAll ? "true" : "false") + ",\"text\":\"" + jsonEscape(text) + "\"}");
  }
  void onChatStatusChangedNotification(ChatStatus* status_) {}
  void onChatMsgDeleteNotification(const zchar_t* msgID, SDKChatMessageDeleteType deleteBy) {}
  void onChatMessageEditNotification(IChatMsgInfo* chatMsg) {}
  void onShareMeetingChatStatusChanged(bool isStart) {}
  void onFileSendStart(ISDKFileSender* sender) {}
  void onFileReceived(ISDKFileReceiver* receiver) {}
  void onFileTransferProgress(SDKFileTransferInfo* info) {}
};

class ParticipantsEvent : public IMeetingParticipantsCtrlEvent {
 public:
  void onUserJoin(IList<unsigned int>* ids, const zchar_t* strUserList = nullptr) {
    if (!ids) return;
    for (int i = 0; i < ids->GetCount(); i++) {
      unsigned int id = ids->GetItem(i);
      emit("{\"type\":\"user\",\"joined\":true,\"userId\":" + to_string(id) + ",\"name\":\"" +
           jsonEscape(userName(id)) + "\"}");
    }
  }
  void onUserLeft(IList<unsigned int>* ids, const zchar_t* strUserList = nullptr) {}
  void onHostChangeNotification(unsigned int userId) { gHostId = userId; }
  void onLowOrRaiseHandStatusChanged(bool bLow, unsigned int userid) {}
  void onUserNamesChanged(IList<unsigned int>* lstUserID) {}
  void onCoHostChangeNotification(unsigned int userId, bool isCoHost) {}
  void onInvalidReclaimHostkey() {}
  void onAllHandsLowered() {}
  void onLocalRecordingStatusChanged(unsigned int user_id, RecordingStatus status) {}
  void onAllowParticipantsRenameNotification(bool bAllow) {}
  void onAllowParticipantsUnmuteSelfNotification(bool bAllow) {}
  void onAllowParticipantsStartVideoNotification(bool bAllow) {}
  void onAllowParticipantsShareWhiteBoardNotification(bool bAllow) {}
  void onRequestLocalRecordingPrivilegeChanged(LocalRecordingRequestPrivilegeStatus status) {}
  void onAllowParticipantsRequestCloudRecording(bool bAllow) {}
  void onInMeetingUserAvatarPathUpdated(unsigned int userID) {}
  void onParticipantProfilePictureStatusChange(bool bHidden) {}
  void onFocusModeStateChanged(bool bEnabled) {}
  void onFocusModeShareTypeChanged(FocusModeShareType type) {}
  void onBotAuthorizerRelationChanged(unsigned int authorizeUserID) {}
  void onVirtualNameTagStatusChanged(bool bOn, unsigned int userID) {}
  void onVirtualNameTagRosterInfoUpdated(unsigned int userID) {}
  void onCreateCompanionRelation(unsigned int parentUserID, unsigned int childUserID) {}
  void onRemoveCompanionRelation(unsigned int childUserID) {}
  void onGrantCoOwnerPrivilegeChanged(bool canGrantOther) {}
};

static ChatEvent gChatEvent;
static ParticipantsEvent gParticipantsEvent;

static void onInMeeting() {
  auto* p = participants();
  if (p) p->SetEvent(&gParticipantsEvent);
  IMeetingChatController* chat = gMeeting->GetMeetingChatController();
  if (chat) {
    SDKError e = chat->SetEvent(&gChatEvent);
    gChatReady = e == SDKERR_SUCCESS;
    if (!gChatReady) logLine("chat SetEvent failed: " + to_string(e));
  } else {
    logLine("no chat controller");
  }
  findHost();
  status("in_meeting", "host=" + to_string(gHostId) + " self=" + to_string(gSelfId));
}

class MeetingEvent : public IMeetingServiceEvent {
 public:
  void onMeetingStatusChanged(MeetingStatus st, int iResult = 0) {
    switch (st) {
      case MEETING_STATUS_CONNECTING: status("connecting"); break;
      case MEETING_STATUS_WAITINGFORHOST: status("waiting_for_host"); break;
      case MEETING_STATUS_IN_WAITING_ROOM: status("waiting_room", "Admítela desde la sala de espera"); break;
      case MEETING_STATUS_INMEETING: onInMeeting(); break;
      case MEETING_STATUS_RECONNECTING: status("reconnecting"); break;
      case MEETING_STATUS_FAILED:
        status("failed", "MeetingFailCode " + to_string(iResult));
        quit(2);
        break;
      case MEETING_STATUS_ENDED:
        status("ended", "EndReason " + to_string(iResult));
        quit(0);
        break;
      default:
        logLine("meeting status " + to_string((int)st) + " result " + to_string(iResult));
    }
  }
  void onMeetingStatisticsWarningNotification(StatisticsWarningType type) {}
  void onMeetingParameterNotification(const MeetingParameter* meeting_param) {}
  void onSuspendParticipantsActivities() {}
  void onAICompanionActiveChangeNotice(bool bActive) {}
  void onMeetingTopicChanged(const zchar_t* sTopic) {}
  void onMeetingFullToWatchLiveStream(const zchar_t* sLiveStreamUrl) {}
  void onUserNetworkStatusChanged(MeetingComponentType type, ConnectionQuality level, unsigned int userId, bool uplink) {}
  void onAppSignalPanelUpdated(IMeetingAppSignalHandler* pHandler) {}
};

static MeetingEvent gMeetingEvent;

static SDKError joinMeeting() {
  JoinParam joinParam;
  joinParam.userType = SDK_UT_WITHOUT_LOGIN;
  JoinParam4WithoutLogin& p = joinParam.param.withoutloginuserJoin;
  p.meetingNumber = stoull(gMeetingNumber);
  p.userName = gDisplayName.c_str();
  p.psw = gPassword.c_str();
  p.vanityID = nullptr;
  p.customer_key = nullptr;
  p.webinarToken = nullptr;
  p.isVideoOff = true;
  p.isAudioOff = true;
  status("joining", gMeetingNumber);
  return gMeeting->Join(joinParam);
}

class AuthEvent : public IAuthServiceEvent {
 public:
  void onAuthenticationReturn(AuthResult ret) {
    if (ret != AUTHRET_SUCCESS) {
      status("failed", "SDK auth failed: AuthResult " + to_string((int)ret));
      quit(3);
    }
    status("authorized");
    SDKError e = joinMeeting();
    if (e != SDKERR_SUCCESS) {
      status("failed", "Join error " + to_string((int)e));
      quit(4);
    }
  }
  void onLoginReturnWithReason(LOGINSTATUS ret, IAccountInfo* pAccountInfo, LoginFailReason reason) {}
  void onLogout() {}
  void onZoomIdentityExpired() {}
  void onZoomAuthIdentityExpired() {}
  void onNotificationServiceStatus(SDKNotificationServiceStatus status, SDKNotificationServiceError error) {}
};

static AuthEvent gAuthEvent;

// ---------------------------------------------------------------- stdin commands

static gboolean onStdin(GIOChannel* ch, GIOCondition cond, gpointer) {
  if (cond & (G_IO_HUP | G_IO_ERR)) {
    // Control server went away: leave cleanly.
    if (gMeeting) gMeeting->Leave(LEAVE_MEETING);
    quit(0);
    return FALSE;
  }
  gchar* line = nullptr;
  gsize len = 0;
  GIOStatus st = g_io_channel_read_line(ch, &line, &len, nullptr, nullptr);
  if (st == G_IO_STATUS_EOF) {
    if (gMeeting) gMeeting->Leave(LEAVE_MEETING);
    quit(0);
    return FALSE;
  }
  if (st != G_IO_STATUS_NORMAL || !line) return TRUE;
  string s(line, len);
  g_free(line);
  while (!s.empty() && (s.back() == '\n' || s.back() == '\r')) s.pop_back();

  if (s == "LEAVE") {
    status("leaving");
    if (gMeeting) gMeeting->Leave(LEAVE_MEETING);
    // MEETING_STATUS_ENDED may not fire for a participant leaving; exit anyway.
    g_timeout_add(4000, [](gpointer) -> gboolean { status("ended", "left"); quit(0); return FALSE; }, nullptr);
    return TRUE;
  }
  if (s.rfind("SEND\t", 0) == 0) {
    size_t a = s.find('\t', 5);
    if (a == string::npos) return TRUE;
    string toStr = s.substr(5, a - 5);
    string text = b64decode(s.substr(a + 1));
    unsigned int to = 0;
    if (toStr == "host") {
      if (!gHostId) findHost();
      to = gHostId;
      if (!to) { logLine("no host found for private note"); return TRUE; }
    } else {
      to = (unsigned int)strtoul(toStr.c_str(), nullptr, 10);
    }
    SDKError e = sendChat(to, text);
    if (e != SDKERR_SUCCESS) logLine("send chat failed: " + to_string((int)e) + " to=" + to_string(to));
  }
  return TRUE;
}

static void onSignal(int) {
  if (gMeeting) gMeeting->Leave(LEAVE_MEETING);
  quit(0);
}

// ---------------------------------------------------------------- main

int main() {
  string key = env("ZOOM_SDK_KEY"), secret = env("ZOOM_SDK_SECRET");
  gMeetingNumber = env("MEETING_NUMBER");
  gPassword = env("MEETING_PASSWORD");
  gDisplayName = env("DISPLAY_NAME", "Sofia");
  if (key.empty() || secret.empty() || gMeetingNumber.empty()) {
    status("failed", "Missing ZOOM_SDK_KEY / ZOOM_SDK_SECRET / MEETING_NUMBER");
    return 1;
  }
  signal(SIGTERM, onSignal);
  signal(SIGINT, onSignal);

  InitParam init;
  init.strWebDomain = "https://zoom.us";
  init.strSupportUrl = "https://zoom.us";
  init.emLanguageID = LANGUAGE_Spanish;
  init.enableLogByDefault = true;
  init.enableGenerateDump = false;
  SDKError e = InitSDK(init);
  if (e != SDKERR_SUCCESS) { status("failed", "InitSDK " + to_string((int)e)); return 1; }

  if ((e = CreateMeetingService(&gMeeting)) != SDKERR_SUCCESS) { status("failed", "CreateMeetingService " + to_string((int)e)); return 1; }
  gMeeting->SetEvent(&gMeetingEvent);
  if ((e = CreateAuthService(&gAuth)) != SDKERR_SUCCESS) { status("failed", "CreateAuthService " + to_string((int)e)); return 1; }
  gAuth->SetEvent(&gAuthEvent);

  gJwt = makeJwt(key, secret);
  AuthContext ctx;
  ctx.jwt_token = gJwt.c_str();
  if ((e = gAuth->SDKAuth(ctx)) != SDKERR_SUCCESS) { status("failed", "SDKAuth " + to_string((int)e)); return 1; }
  status("authorizing");

  GIOChannel* in = g_io_channel_unix_new(STDIN_FILENO);
  g_io_add_watch(in, (GIOCondition)(G_IO_IN | G_IO_HUP | G_IO_ERR), onStdin, nullptr);

  gLoop = g_main_loop_new(nullptr, FALSE);
  g_main_loop_run(gLoop);
  return 0;
}
