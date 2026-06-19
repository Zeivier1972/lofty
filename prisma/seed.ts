import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  // Create default user
  const hashedPassword = await bcrypt.hash("password123", 12)
  const user = await prisma.user.upsert({
    where: { email: "agent@casaicrm.com" },
    update: {},
    create: {
      name: "Alex Johnson",
      email: "agent@casaicrm.com",
      password: hashedPassword,
      role: "AGENT",
      phone: "(555) 123-4567",
      title: "Real Estate Agent",
      bio: "Top producing agent with 10+ years of experience in residential real estate.",
    },
  })

  // Create tags
  const tags = await Promise.all([
    prisma.tag.upsert({ where: { name: "Hot Lead" }, update: {}, create: { name: "Hot Lead", color: "#EF4444" } }),
    prisma.tag.upsert({ where: { name: "Buyer" }, update: {}, create: { name: "Buyer", color: "#3B82F6" } }),
    prisma.tag.upsert({ where: { name: "Seller" }, update: {}, create: { name: "Seller", color: "#10B981" } }),
    prisma.tag.upsert({ where: { name: "Investor" }, update: {}, create: { name: "Investor", color: "#8B5CF6" } }),
    prisma.tag.upsert({ where: { name: "Referral" }, update: {}, create: { name: "Referral", color: "#F59E0B" } }),
    prisma.tag.upsert({ where: { name: "VIP" }, update: {}, create: { name: "VIP", color: "#EC4899" } }),
    prisma.tag.upsert({ where: { name: "Past Client" }, update: {}, create: { name: "Past Client", color: "#6B7280" } }),
    prisma.tag.upsert({ where: { name: "Sphere" }, update: {}, create: { name: "Sphere", color: "#14B8A6" } }),
  ])

  // Create default pipeline
  const pipeline = await prisma.pipeline.upsert({
    where: { id: "default-pipeline" },
    update: {},
    create: {
      id: "default-pipeline",
      name: "Sales Pipeline",
      isDefault: true,
      stages: {
        create: [
          { name: "New Lead", order: 1, color: "#6B7280" },
          { name: "Contacted", order: 2, color: "#3B82F6" },
          { name: "Qualified", order: 3, color: "#8B5CF6" },
          { name: "Showing", order: 4, color: "#F59E0B" },
          { name: "Offer Made", order: 5, color: "#EF4444" },
          { name: "Under Contract", order: 6, color: "#10B981" },
          { name: "Closed", order: 7, color: "#059669" },
        ],
      },
    },
    include: { stages: true },
  })

  // Create contacts
  const contactsData = [
    {
      firstName: "Michael", lastName: "Anderson",
      email: "m.anderson@gmail.com", phone: "(555) 234-5678",
      city: "Austin", state: "TX", zip: "78701",
      source: "ZILLOW", status: "ACTIVE_CLIENT", leadScore: 85,
      buyerBudgetMin: 400000, buyerBudgetMax: 600000,
      buyerBedroomsMin: 3, buyerLocation: "Austin, TX",
    },
    {
      firstName: "Sarah", lastName: "Martinez",
      email: "sarah.m@email.com", phone: "(555) 345-6789",
      city: "Austin", state: "TX", zip: "78704",
      source: "REFERRAL", status: "LEAD", leadScore: 72,
      buyerBudgetMin: 300000, buyerBudgetMax: 450000,
    },
    {
      firstName: "James", lastName: "Wilson",
      email: "jwilson@company.com", phone: "(555) 456-7890",
      city: "Austin", state: "TX", zip: "78705",
      source: "WEBSITE", status: "PROSPECT", leadScore: 60,
      sellerAddress: "123 Oak Lane, Austin TX",
      sellerEstimatedValue: 520000,
    },
    {
      firstName: "Emily", lastName: "Chen",
      email: "emily.chen@email.com", phone: "(555) 567-8901",
      city: "Austin", state: "TX", zip: "78702",
      source: "FACEBOOK", status: "LEAD", leadScore: 45,
      buyerBudgetMin: 250000, buyerBudgetMax: 350000,
    },
    {
      firstName: "Robert", lastName: "Thompson",
      email: "rthompson@gmail.com", phone: "(555) 678-9012",
      city: "Austin", state: "TX", zip: "78703",
      source: "OPEN_HOUSE", status: "ACTIVE_CLIENT", leadScore: 90,
      buyerBudgetMin: 600000, buyerBudgetMax: 900000,
    },
    {
      firstName: "Jennifer", lastName: "Davis",
      email: "jdavis@email.com", phone: "(555) 789-0123",
      city: "Austin", state: "TX", zip: "78701",
      source: "GOOGLE", status: "PAST_CLIENT", leadScore: 55,
    },
    {
      firstName: "David", lastName: "Garcia",
      email: "d.garcia@company.com", phone: "(555) 890-1234",
      city: "Austin", state: "TX", zip: "78744",
      source: "REFERRAL", status: "SPHERE_OF_INFLUENCE", leadScore: 30,
    },
    {
      firstName: "Lisa", lastName: "Brown",
      email: "lbrown@gmail.com", phone: "(555) 901-2345",
      city: "Austin", state: "TX", zip: "78745",
      source: "INSTAGRAM", status: "LEAD", leadScore: 65,
      buyerBudgetMin: 350000, buyerBudgetMax: 500000,
    },
    {
      firstName: "Christopher", lastName: "Lee",
      email: "chris.lee@email.com", phone: "(555) 012-3456",
      city: "Austin", state: "TX", zip: "78746",
      source: "ZILLOW", status: "PROSPECT", leadScore: 78,
    },
    {
      firstName: "Amanda", lastName: "Taylor",
      email: "ataylor@email.com", phone: "(555) 111-2222",
      city: "Austin", state: "TX", zip: "78747",
      source: "COLD_CALL", status: "LEAD", leadScore: 40,
    },
  ]

  const contacts = []
  for (const data of contactsData) {
    const contact = await prisma.contact.create({
      data: { ...data, assignedToId: user.id },
    })
    contacts.push(contact)
  }

  // Assign tags to contacts
  await prisma.contactTag.createMany({
    data: [
      { contactId: contacts[0].id, tagId: tags[1].id },
      { contactId: contacts[0].id, tagId: tags[0].id },
      { contactId: contacts[1].id, tagId: tags[1].id },
      { contactId: contacts[2].id, tagId: tags[2].id },
      { contactId: contacts[3].id, tagId: tags[1].id },
      { contactId: contacts[4].id, tagId: tags[3].id },
      { contactId: contacts[4].id, tagId: tags[0].id },
      { contactId: contacts[5].id, tagId: tags[6].id },
      { contactId: contacts[6].id, tagId: tags[7].id },
      { contactId: contacts[7].id, tagId: tags[4].id },
    ],
  })

  // Add contacts to pipeline stages
  await prisma.pipelineLead.createMany({
    data: [
      { contactId: contacts[0].id, stageId: pipeline.stages[3].id, value: 520000, probability: 70 },
      { contactId: contacts[1].id, stageId: pipeline.stages[1].id, value: 380000, probability: 30 },
      { contactId: contacts[2].id, stageId: pipeline.stages[2].id, value: 520000, probability: 50 },
      { contactId: contacts[3].id, stageId: pipeline.stages[0].id, value: 300000, probability: 20 },
      { contactId: contacts[4].id, stageId: pipeline.stages[4].id, value: 750000, probability: 85 },
      { contactId: contacts[7].id, stageId: pipeline.stages[1].id, value: 425000, probability: 35 },
      { contactId: contacts[8].id, stageId: pipeline.stages[2].id, value: 460000, probability: 55 },
    ],
  })

  // Create properties
  await prisma.property.createMany({
    data: [
      {
        address: "2847 Maple Drive",
        city: "Austin", state: "TX", zip: "78701",
        price: 485000, bedrooms: 3, bathrooms: 2, sqft: 1850,
        yearBuilt: 2018, propertyType: "SINGLE_FAMILY", status: "ACTIVE",
        description: "Beautiful updated home in prime location. Open floor plan, modern kitchen, large backyard.",
        garage: 2, listingDate: new Date("2024-01-15"), daysOnMarket: 12,
        images: JSON.stringify(["https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800"]),
        features: JSON.stringify(["Granite Countertops", "Hardwood Floors", "Smart Home", "Pool-Ready Backyard"]),
      },
      {
        address: "1423 Oak Street #204",
        city: "Austin", state: "TX", zip: "78704",
        price: 320000, bedrooms: 2, bathrooms: 2, sqft: 1100,
        yearBuilt: 2015, propertyType: "CONDO", status: "ACTIVE",
        description: "Modern condo in the heart of South Austin. Walking distance to restaurants and shops.",
        garage: 1, hoa: 250, listingDate: new Date("2024-01-20"), daysOnMarket: 7,
        images: JSON.stringify(["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800"]),
      },
      {
        address: "5621 Riverside Court",
        city: "Austin", state: "TX", zip: "78703",
        price: 875000, bedrooms: 4, bathrooms: 3.5, sqft: 3200,
        yearBuilt: 2020, propertyType: "SINGLE_FAMILY", status: "ACTIVE",
        description: "Stunning luxury home with river views. Chef's kitchen, primary suite with spa bath.",
        garage: 3, pool: true, listingDate: new Date("2024-01-10"), daysOnMarket: 22,
        images: JSON.stringify(["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800"]),
        features: JSON.stringify(["Pool", "River Views", "Wine Cellar", "Home Theater", "Smart Home"]),
      },
      {
        address: "934 Cedar Lane",
        city: "Austin", state: "TX", zip: "78745",
        price: 265000, bedrooms: 2, bathrooms: 1, sqft: 980,
        yearBuilt: 1998, propertyType: "SINGLE_FAMILY", status: "PENDING",
        description: "Charming starter home in established neighborhood. Recently updated kitchen and bath.",
        garage: 1, listingDate: new Date("2024-01-05"), daysOnMarket: 28,
        images: JSON.stringify(["https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800"]),
      },
      {
        address: "3301 Lake Shore Drive",
        city: "Austin", state: "TX", zip: "78746",
        price: 1250000, bedrooms: 5, bathrooms: 4, sqft: 4800,
        yearBuilt: 2019, propertyType: "SINGLE_FAMILY", status: "ACTIVE",
        description: "Exceptional lakefront property. Private dock, pool, outdoor kitchen.",
        garage: 3, pool: true, listingDate: new Date("2024-01-18"), daysOnMarket: 15,
        images: JSON.stringify(["https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800"]),
        features: JSON.stringify(["Lake Front", "Private Dock", "Pool", "Outdoor Kitchen", "3-Car Garage"]),
      },
    ],
  })

  // Create tasks
  const now = new Date()
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1)
  const nextWeek = new Date(now); nextWeek.setDate(nextWeek.getDate() + 7)
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)

  await prisma.task.createMany({
    data: [
      {
        title: "Follow up with Michael Anderson",
        description: "Call to schedule property showings this weekend",
        dueDate: tomorrow, dueTime: "10:00", priority: "HIGH",
        status: "PENDING", type: "CALL",
        contactId: contacts[0].id, assignedToId: user.id,
      },
      {
        title: "Send listing presentation to James Wilson",
        description: "Prepare and send CMA report for Seller consultation",
        dueDate: tomorrow, dueTime: "14:00", priority: "HIGH",
        status: "PENDING", type: "EMAIL",
        contactId: contacts[2].id, assignedToId: user.id,
      },
      {
        title: "Schedule buyer consultation - Emily Chen",
        description: "Initial buyer consultation to discuss needs and pre-approval",
        dueDate: nextWeek, dueTime: "11:00", priority: "MEDIUM",
        status: "PENDING", type: "MEETING",
        contactId: contacts[3].id, assignedToId: user.id,
      },
      {
        title: "Prepare offer for Robert Thompson",
        description: "Draft offer for 3301 Lake Shore Drive",
        dueDate: tomorrow, dueTime: "16:00", priority: "URGENT",
        status: "IN_PROGRESS", type: "OFFER",
        contactId: contacts[4].id, assignedToId: user.id,
      },
      {
        title: "Check in with past client - Jennifer Davis",
        description: "Annual check-in and ask for referrals",
        dueDate: nextWeek, dueTime: "09:00", priority: "LOW",
        status: "PENDING", type: "CALL",
        contactId: contacts[5].id, assignedToId: user.id,
      },
      {
        title: "Follow up with Sarah Martinez",
        description: "Send new listings matching her criteria",
        dueDate: yesterday, priority: "MEDIUM",
        status: "PENDING", type: "EMAIL",
        contactId: contacts[1].id, assignedToId: user.id,
      },
    ],
  })

  // Create appointments
  const today9am = new Date(now); today9am.setHours(9, 0, 0, 0)
  const today11am = new Date(now); today11am.setHours(11, 0, 0, 0)
  const tomorrow2pm = new Date(tomorrow); tomorrow2pm.setHours(14, 0, 0, 0)
  const tomorrow4pm = new Date(tomorrow); tomorrow4pm.setHours(16, 0, 0, 0)

  await prisma.appointment.createMany({
    data: [
      {
        title: "Property Showing - 2847 Maple Drive",
        startTime: today11am, endTime: new Date(today11am.getTime() + 3600000),
        location: "2847 Maple Drive, Austin TX 78701",
        type: "SHOWING", status: "SCHEDULED",
        contactId: contacts[0].id, userId: user.id,
      },
      {
        title: "Listing Appointment - James Wilson",
        startTime: tomorrow2pm, endTime: new Date(tomorrow2pm.getTime() + 5400000),
        location: "123 Oak Lane, Austin TX",
        type: "LISTING_APPOINTMENT", status: "CONFIRMED",
        contactId: contacts[2].id, userId: user.id,
      },
      {
        title: "Buyer Consultation - Robert Thompson",
        startTime: tomorrow4pm, endTime: new Date(tomorrow4pm.getTime() + 3600000),
        location: "Office",
        type: "BUYER_CONSULTATION", status: "SCHEDULED",
        contactId: contacts[4].id, userId: user.id,
      },
    ],
  })

  // Create notes
  await prisma.note.createMany({
    data: [
      {
        content: "Very motivated buyer. Pre-approved up to $600k. Looking to move within 60 days. Prefers east Austin.",
        contactId: contacts[0].id, authorId: user.id, isPinned: true,
      },
      {
        content: "Showed 3 properties today. Most interested in 2847 Maple Drive. Will discuss with spouse.",
        contactId: contacts[0].id, authorId: user.id,
      },
      {
        content: "Inherited property from parents. Looking to sell quickly. Some deferred maintenance.",
        contactId: contacts[2].id, authorId: user.id, isPinned: true,
      },
      {
        content: "Investor with multiple properties. Looking for cash-flow properties in 78745 zip code.",
        contactId: contacts[4].id, authorId: user.id, isPinned: true,
      },
    ],
  })

  // Create activities
  await prisma.activity.createMany({
    data: [
      {
        type: "CONTACT_CREATED", title: "Contact created",
        contactId: contacts[0].id, userId: user.id,
        createdAt: new Date(now.getTime() - 7 * 24 * 3600000),
      },
      {
        type: "EMAIL_SENT", title: "Welcome email sent",
        description: "Sent initial welcome email with property search link",
        contactId: contacts[0].id, userId: user.id,
        createdAt: new Date(now.getTime() - 6 * 24 * 3600000),
      },
      {
        type: "CALL_MADE", title: "Phone call - 12 minutes",
        description: "Discussed needs, budget, and timeline",
        contactId: contacts[0].id, userId: user.id,
        createdAt: new Date(now.getTime() - 4 * 24 * 3600000),
      },
      {
        type: "PROPERTY_VIEWED", title: "Property showing",
        description: "Showed 3 properties in east Austin",
        contactId: contacts[0].id, userId: user.id,
        createdAt: new Date(now.getTime() - 2 * 24 * 3600000),
      },
      {
        type: "NOTE_ADDED", title: "Note added",
        contactId: contacts[0].id, userId: user.id,
        createdAt: new Date(now.getTime() - 1 * 24 * 3600000),
      },
      {
        type: "CONTACT_CREATED", title: "Contact created",
        contactId: contacts[4].id, userId: user.id,
        createdAt: new Date(now.getTime() - 14 * 24 * 3600000),
      },
      {
        type: "PIPELINE_MOVED", title: "Moved to Offer Made",
        contactId: contacts[4].id, userId: user.id,
        createdAt: new Date(now.getTime() - 3 * 24 * 3600000),
      },
    ],
  })

  // Create email templates
  await prisma.emailTemplate.createMany({
    data: [
      {
        name: "New Lead Welcome",
        subject: "Welcome! Let's Find Your Dream Home",
        body: `Hi {firstName},\n\nThank you for reaching out! I'm excited to help you find the perfect property.\n\nI'd love to schedule a quick call to learn more about what you're looking for. Please feel free to reply to this email or call me at (555) 123-4567.\n\nBest regards,\n{agentName}`,
        category: "BUYER",
        isShared: true,
      },
      {
        name: "Listing Presentation Follow-up",
        subject: "Your Home's Value Report - {address}",
        body: `Hi {firstName},\n\nThank you for meeting with me today! As promised, I've attached your Comparative Market Analysis for {address}.\n\nBased on current market conditions, I recommend listing your home between $X and $X. Properties in your area are selling in an average of X days.\n\nI'd love to get started right away. When would you like to list?\n\nBest,\n{agentName}`,
        category: "SELLER",
        isShared: true,
      },
      {
        name: "Property Match Alert",
        subject: "New Properties Matching Your Criteria",
        body: `Hi {firstName},\n\nI found some great new listings that match what you're looking for! Check them out:\n\n{propertyList}\n\nWould you like to schedule showings? I have availability this weekend.\n\nBest,\n{agentName}`,
        category: "BUYER",
        isShared: true,
      },
      {
        name: "Market Update",
        subject: "Austin Real Estate Market Update - {month} {year}",
        body: `Hi {firstName},\n\nHere's your monthly Austin real estate market update:\n\n• Median home price: $X (X% from last month)\n• Average days on market: X days\n• Homes sold this month: X\n\nIt's currently a {marketType} market. This is a great time to {buyOrSell}!\n\nLet me know if you have any questions.\n\nBest,\n{agentName}`,
        category: "GENERAL",
        isShared: true,
      },
      {
        name: "Under Contract Congratulations",
        subject: "Congratulations - You're Under Contract!",
        body: `Hi {firstName},\n\nCongratulations! Your offer on {address} has been accepted and you're now under contract!\n\nHere are the next steps:\n1. Home inspection scheduled for {inspectionDate}\n2. Appraisal will be ordered by your lender\n3. Final walkthrough scheduled for {walkthroughDate}\n4. Closing is set for {closingDate}\n\nI'll be with you every step of the way. Don't hesitate to reach out!\n\nBest,\n{agentName}`,
        category: "TRANSACTION",
        isShared: true,
      },
    ],
  })

  // Create smart plans
  const welcomePlan = await prisma.smartPlan.create({
    data: {
      name: "New Buyer Welcome Sequence",
      description: "Automated follow-up sequence for new buyer leads",
      trigger: "CONTACT_CREATED",
      isActive: true,
      userId: user.id,
      steps: {
        create: [
          { order: 1, type: "EMAIL", delay: 0, subject: "Welcome! Let's Find Your Dream Home", content: "Hi {firstName}, welcome to my buyer program..." },
          { order: 2, type: "TASK", delay: 1, taskType: "CALL", taskTitle: "Call new buyer lead {firstName}" },
          { order: 3, type: "EMAIL", delay: 3, subject: "New Listings in Your Search Area", content: "Hi {firstName}, I found some great new listings for you..." },
          { order: 4, type: "TASK", delay: 7, taskType: "FOLLOW_UP", taskTitle: "Follow up with {firstName} - week 1 check-in" },
          { order: 5, type: "EMAIL", delay: 14, subject: "Austin Market Update", content: "Here's what's happening in the Austin market this week..." },
          { order: 6, type: "TASK", delay: 21, taskType: "CALL", taskTitle: "3-week follow up call with {firstName}" },
          { order: 7, type: "EMAIL", delay: 30, subject: "Checking In - Your Home Search", content: "Hi {firstName}, just wanted to check in on your home search..." },
        ],
      },
    },
  })

  const sellerPlan = await prisma.smartPlan.create({
    data: {
      name: "Seller Lead Nurture",
      description: "Long-term nurture plan for seller leads",
      trigger: "MANUAL",
      isActive: true,
      userId: user.id,
      steps: {
        create: [
          { order: 1, type: "EMAIL", delay: 0, subject: "Your Home's Current Market Value", content: "Hi {firstName}, here's a market analysis for your area..." },
          { order: 2, type: "TASK", delay: 2, taskType: "CALL", taskTitle: "Seller consultation call - {firstName}" },
          { order: 3, type: "EMAIL", delay: 7, subject: "Recent Sales Near Your Home", content: "Check out these recent sales near {address}..." },
          { order: 4, type: "TASK", delay: 14, taskType: "FOLLOW_UP", taskTitle: "Follow up - listing timeline with {firstName}" },
          { order: 5, type: "EMAIL", delay: 30, subject: "Monthly Market Report", content: "Here's your monthly market update..." },
        ],
      },
    },
  })

  // Enroll contacts in smart plans
  await prisma.smartPlanEnrollment.createMany({
    data: [
      { planId: welcomePlan.id, contactId: contacts[1].id, currentStep: 2, status: "ACTIVE" },
      { planId: welcomePlan.id, contactId: contacts[3].id, currentStep: 1, status: "ACTIVE" },
      { planId: sellerPlan.id, contactId: contacts[2].id, currentStep: 3, status: "ACTIVE" },
    ],
  })

  // Create a transaction
  const transaction = await prisma.transaction.create({
    data: {
      title: "2847 Maple Drive - Buyer",
      address: "2847 Maple Drive",
      city: "Austin", state: "TX", zip: "78701",
      type: "BUYER",
      status: "UNDER_CONTRACT",
      listPrice: 485000,
      salePrice: 475000,
      commission: 14250,
      commissionPercent: 3,
      contractDate: new Date(now.getTime() - 5 * 24 * 3600000),
      closeDate: new Date(now.getTime() + 25 * 24 * 3600000),
      mlsNumber: "MLS-2024-001234",
      contactId: contacts[0].id,
      agentId: user.id,
    },
  })

  await prisma.transactionMilestone.createMany({
    data: [
      { transactionId: transaction.id, name: "Contract Signed", order: 1, dueDate: new Date(now.getTime() - 5 * 24 * 3600000), status: "COMPLETED", completedDate: new Date(now.getTime() - 5 * 24 * 3600000) },
      { transactionId: transaction.id, name: "Home Inspection", order: 2, dueDate: new Date(now.getTime() - 2 * 24 * 3600000), status: "COMPLETED", completedDate: new Date(now.getTime() - 2 * 24 * 3600000) },
      { transactionId: transaction.id, name: "Inspection Response", order: 3, dueDate: new Date(now.getTime() + 1 * 24 * 3600000), status: "PENDING" },
      { transactionId: transaction.id, name: "Appraisal", order: 4, dueDate: new Date(now.getTime() + 7 * 24 * 3600000), status: "PENDING" },
      { transactionId: transaction.id, name: "Loan Approval", order: 5, dueDate: new Date(now.getTime() + 14 * 24 * 3600000), status: "PENDING" },
      { transactionId: transaction.id, name: "Final Walkthrough", order: 6, dueDate: new Date(now.getTime() + 24 * 24 * 3600000), status: "PENDING" },
      { transactionId: transaction.id, name: "Closing", order: 7, dueDate: new Date(now.getTime() + 25 * 24 * 3600000), status: "PENDING" },
    ],
  })

  console.log("✅ Database seeded successfully!")
  console.log(`\nLogin credentials:\n  Email: agent@casaicrm.com\n  Password: password123`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
