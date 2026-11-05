cmake_minimum_required(VERSION 3.22)
project(sofia_bot CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_BUILD_TYPE Release)

set(ZOOM_SDK ${CMAKE_SOURCE_DIR}/sdk)
find_package(PkgConfig REQUIRED)
pkg_check_modules(GLIB REQUIRED IMPORTED_TARGET glib-2.0)
find_package(OpenSSL REQUIRED)

include_directories(${ZOOM_SDK}/h)
link_directories(${ZOOM_SDK})

add_executable(sofia-bot src/main.cpp)
target_link_libraries(sofia-bot PRIVATE meetingsdk PkgConfig::GLIB OpenSSL::Crypto)
set_target_properties(sofia-bot PROPERTIES BUILD_RPATH "${ZOOM_SDK};${ZOOM_SDK}/qt_libs/Qt/lib" INSTALL_RPATH "${ZOOM_SDK};${ZOOM_SDK}/qt_libs/Qt/lib")
