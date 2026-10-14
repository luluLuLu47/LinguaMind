/**
 * LinguaMind 场景数据
 * 英语和韩语的预设对话场景，每个场景包含角色、剧情节点、预设词汇
 */

export interface SceneNode {
  id: string
  title: string                       // 场景节点名称
  description: string                 // 场景描述
  role: string                        // AI扮演的角色
  userRole: string                    // 用户扮演的角色
  targetVocabulary: string[]          // 目标词汇
  targetGrammar: string[]             // 目标语法点
  difficulty: "beginner" | "intermediate" | "advanced"
  openingLine: string                 // 开场白
  tips: string[]                      // 学习提示
}

export interface SceneCategory {
  id: string
  name: string
  nameKo?: string                     // 韩语名称
  icon: string
  description: string
}

// ============================================================
// 场景分类
// ============================================================

export const sceneCategories: Record<string, SceneCategory[]> = {
  en: [
    { id: "daily", name: "Daily Life", icon: "🏠", description: "日常生活" },
    { id: "travel", name: "Travel", icon: "✈️", description: "旅行出行" },
    { id: "food", name: "Food & Dining", icon: "🍽️", description: "餐饮美食" },
    { id: "work", name: "Work & Study", icon: "💼", description: "工作学习" },
    { id: "social", name: "Social", icon: "💬", description: "社交互动" },
    { id: "shopping", name: "Shopping", icon: "🛍️", description: "购物消费" },
    { id: "health", name: "Health", icon: "🏥", description: "医疗健康" },
    { id: "entertainment", name: "Entertainment", icon: "🎬", description: "娱乐休闲" },
    { id: "emergency", name: "Emergency", icon: "🆘", description: "紧急情况" },
  ],
  ko: [
    { id: "daily", name: "일상 생활", icon: "🏠", description: "日常生活" },
    { id: "travel", name: "여행", icon: "✈️", description: "旅行出行" },
    { id: "food", name: "음식", icon: "🍽️", description: "餐饮美食" },
    { id: "work", name: "직장/학교", icon: "💼", description: "工作学习" },
    { id: "social", name: "사교", icon: "💬", description: "社交互动" },
    { id: "shopping", name: "쇼핑", icon: "🛍️", description: "购物消费" },
    { id: "health", name: "건강", icon: "🏥", description: "医疗健康" },
  ],
}

// ============================================================
// 英语场景
// ============================================================

export const englishScenes: SceneNode[] = [
  // =========================================
  // Daily Life (8 scenes)
  // =========================================
  {
    id: "en-coffee-shop", title: "At the Coffee Shop", description: "咖啡店点单",
    role: "Barista", userRole: "Customer",
    targetVocabulary: ["latte", "cappuccino", "iced", "hot", "take away", "for here", "pastry", "croissant", "muffin"],
    targetGrammar: ["Would you like...", "Can I have...", "I'd like...", "How much is..."],
    difficulty: "beginner",
    openingLine: "Hi there! Welcome to Coffee Corner. What can I get for you today?",
    tips: ["Order a drink and a snack", "Ask about sizes", "Use 'please' and 'thank you'"],
  },
  {
    id: "en-grocery", title: "At the Grocery Store", description: "超市购物",
    role: "Store Clerk", userRole: "Shopper",
    targetVocabulary: ["aisle", "fresh produce", "dairy", "on sale", "discount", "checkout", "organic", "shopping cart"],
    targetGrammar: ["Where can I find...", "How much is...", "Do you have...", "I'm looking for..."],
    difficulty: "beginner",
    openingLine: "Hello! Do you need any help finding something?",
    tips: ["Ask where items are located", "Inquire about prices", "Say left/right/aisle numbers"],
  },
  {
    id: "en-post-office", title: "At the Post Office", description: "邮局寄件",
    role: "Postal Clerk", userRole: "Customer",
    targetVocabulary: ["stamp", "package", "express", "tracking number", "envelope", "postcard", "fragile", "registered mail", "weigh"],
    targetGrammar: ["I'd like to send...", "How long will it take...", "How much does it cost...", "Could you weigh this..."],
    difficulty: "beginner",
    openingLine: "Next in line please! How can I help you today?",
    tips: ["Specify where you're sending to", "Ask about delivery time", "Choose regular or express"],
  },
  {
    id: "en-bank", title: "At the Bank", description: "银行办理业务",
    role: "Bank Teller", userRole: "Customer",
    targetVocabulary: ["account", "deposit", "withdraw", "transfer", "balance", "savings", "interest rate", "loan", "ATM"],
    targetGrammar: ["I'd like to open...", "Could you help me with...", "I need to transfer...", "What's the interest rate..."],
    difficulty: "intermediate",
    openingLine: "Good morning! How can I assist you with your banking today?",
    tips: ["State what you want to do clearly", "Ask about fees or rates", "Confirm the transaction"],
  },
  {
    id: "en-library", title: "At the Library", description: "图书馆借书",
    role: "Librarian", userRole: "Library Visitor",
    targetVocabulary: ["borrow", "return", "due date", "overdue", "renew", "catalog", "fiction", "non-fiction", "membership"],
    targetGrammar: ["I'm looking for...", "Can I borrow...", "When is this due...", "Can I renew..."],
    difficulty: "beginner",
    openingLine: "Hello! Welcome to City Library. How can I help you today?",
    tips: ["Ask about specific books or authors", "Check the due date", "Ask about renewals"],
  },
  {
    id: "en-laundry", title: "At the Laundromat", description: "自助洗衣店",
    role: "Laundromat Attendant", userRole: "Customer",
    targetVocabulary: ["washer", "dryer", "detergent", "fabric softener", "coin", "cycle", "delicate", "stain", "fold"],
    targetGrammar: ["How do I use...", "How long does...", "Which setting for...", "I need change for..."],
    difficulty: "beginner",
    openingLine: "Hi there! First time here? Need help with the machines?",
    tips: ["Ask how to operate machines", "Choose the right cycle", "Ask about drying time"],
  },
  {
    id: "en-car-rental", title: "Car Rental", description: "租车服务",
    role: "Rental Agent", userRole: "Customer",
    targetVocabulary: ["rental", "insurance", "mileage", "compact", "SUV", "pick up", "drop off", "fuel", "deposit"],
    targetGrammar: ["I'd like to rent...", "What's included in...", "Is insurance covered...", "Where do I return..."],
    difficulty: "intermediate",
    openingLine: "Welcome to Apex Car Rental! Do you have a reservation with us?",
    tips: ["Specify the car type you want", "Ask about insurance options", "Confirm pickup and return details"],
  },
  {
    id: "en-apartment", title: "Renting an Apartment", description: "租房看房",
    role: "Landlord / Agent", userRole: "Potential Tenant",
    targetVocabulary: ["lease", "utilities", "furnished", "deposit", "pet-friendly", "renovation", "neighborhood", "monthly rent"],
    targetGrammar: ["How much is...", "Is it furnished...", "Are utilities included...", "What's the lease term..."],
    difficulty: "intermediate",
    openingLine: "Hi! Thanks for coming to see the apartment. Let me show you around.",
    tips: ["Ask about rent and utilities", "Check the lease terms", "Ask about the neighborhood"],
  },
  // =========================================
  // Travel (6 scenes)
  // =========================================
  {
    id: "en-hotel-checkin", title: "Hotel Check-in", description: "酒店入住",
    role: "Hotel Receptionist", userRole: "Guest",
    targetVocabulary: ["reservation", "check-in", "check-out", "luggage", "wake-up call", "complimentary", "suite", "amenities"],
    targetGrammar: ["I have a reservation under...", "Could I have...", "Is breakfast included...", "What time is..."],
    difficulty: "beginner",
    openingLine: "Good afternoon! Welcome to Grand Hotel. Do you have a reservation?",
    tips: ["State your name and reservation", "Ask about breakfast and Wi-Fi", "Request extras if needed"],
  },
  {
    id: "en-airport", title: "At the Airport", description: "机场值机",
    role: "Check-in Agent", userRole: "Passenger",
    targetVocabulary: ["boarding pass", "carry-on", "departure gate", "delay", "security check", "passport", "aisle seat", "overbooked"],
    targetGrammar: ["I'm flying to...", "How many bags...", "When does boarding start...", "Which gate..."],
    difficulty: "intermediate",
    openingLine: "Next please! Where are you flying to today?",
    tips: ["Tell your destination", "Ask about luggage allowance", "Confirm gate and boarding time"],
  },
  {
    id: "en-customs", title: "At Customs", description: "海关入境",
    role: "Customs Officer", userRole: "Traveler",
    targetVocabulary: ["purpose of visit", "declaration", "visa", "duration", "accommodation", "return ticket", "goods", "prohibited"],
    targetGrammar: ["I'm here for...", "I'll be staying for...", "I have nothing to declare", "I'm staying at..."],
    difficulty: "advanced",
    openingLine: "Good afternoon. Passport please. What's the purpose of your visit?",
    tips: ["State your purpose clearly", "Mention how long you'll stay", "Declare any items if needed"],
  },
  {
    id: "en-taxi", title: "Taking a Taxi", description: "打车出行",
    role: "Taxi Driver", userRole: "Passenger",
    targetVocabulary: ["destination", "fare", "meter", "shortcut", "traffic", "drop off", "trunk", "receipt", "keep the change"],
    targetGrammar: ["Can you take me to...", "How much to...", "Could you turn on the meter...", "Please drop me off at..."],
    difficulty: "beginner",
    openingLine: "Hop in! Where are you headed?",
    tips: ["Tell the driver your destination", "Ask about the fare", "Give directions if needed"],
  },
  {
    id: "en-subway", title: "Taking the Subway", description: "乘坐地铁",
    role: "Subway Station Staff", userRole: "Commuter",
    targetVocabulary: ["platform", "transfer", "line", "express", "local", "ticket machine", "metro card", "rush hour", "delay"],
    targetGrammar: ["Which line goes to...", "Where do I transfer...", "How many stops to...", "Is this the right platform..."],
    difficulty: "beginner",
    openingLine: "Need help figuring out the subway? Where are you trying to go?",
    tips: ["Ask which line to take", "Confirm transfer stations", "Check if it's express or local"],
  },
  {
    id: "en-tourist-info", title: "Tourist Information", description: "游客中心咨询",
    role: "Tourist Information Staff", userRole: "Tourist",
    targetVocabulary: ["sightseeing", "attraction", "guided tour", "brochure", "landmark", "opening hours", "admission fee", "free", "map"],
    targetGrammar: ["What's worth seeing...", "How do I get to...", "Is there a guided tour...", "What time does it open..."],
    difficulty: "intermediate",
    openingLine: "Welcome to the Visitor Center! How can I help you explore the city?",
    tips: ["Ask about top attractions", "Get directions or a map", "Check opening hours and fees"],
  },
  // =========================================
  // Food & Dining (5 scenes)
  // =========================================
  {
    id: "en-restaurant", title: "At a Restaurant", description: "餐厅点餐",
    role: "Waiter/Waitress", userRole: "Customer",
    targetVocabulary: ["appetizer", "main course", "dessert", "bill", "rare", "medium", "well-done", "recommendation", "tip"],
    targetGrammar: ["I'd like to order...", "Could you recommend...", "How would you like...", "Can I have the bill..."],
    difficulty: "beginner",
    openingLine: "Good evening! Here's your menu. Can I start you off with something to drink?",
    tips: ["Order a full meal", "Ask for recommendations", "Specify how you want steak cooked"],
  },
  {
    id: "en-fast-food", title: "Fast Food Order", description: "快餐点餐",
    role: "Cashier", userRole: "Customer",
    targetVocabulary: ["combo meal", "upsize", "dine-in", "take-out", "ketchup", "napkin", "straw", "refill", "drive-thru"],
    targetGrammar: ["I'll have...", "Can I get a combo...", "To go please", "No onions please..."],
    difficulty: "beginner",
    openingLine: "Welcome to Burger Barn! What can I get for you today?",
    tips: ["Order a combo meal", "Specify any customizations", "Say dine-in or take-out"],
  },
  {
    id: "en-food-truck", title: "Food Truck", description: "街边餐车",
    role: "Food Truck Owner", userRole: "Customer",
    targetVocabulary: ["taco", "burrito", "salsa", "guacamole", "spicy", "mild", "topping", "side", "popular", "fresh"],
    targetGrammar: ["What's popular here...", "Can I get extra...", "How spicy is...", "I'll try the..."],
    difficulty: "beginner",
    openingLine: "Hey there! Hungry? We've got the best tacos in town. What can I make for you?",
    tips: ["Ask what's popular", "Choose your spice level", "Ask about toppings"],
  },
  {
    id: "en-bbq-party", title: "BBQ Party", description: "烧烤聚会",
    role: "BBQ Host", userRole: "Guest",
    targetVocabulary: ["grill", "burger", "steak", "charcoal", "medium rare", "marinate", "side dish", "bring", "potluck"],
    targetGrammar: ["What can I bring...", "How would you like yours...", "I'll have mine...", "This is delicious..."],
    difficulty: "intermediate",
    openingLine: "Hey, glad you made it! Grab a drink — the grill's just getting hot. What would you like me to throw on?",
    tips: ["Ask what you can bring", "Tell them how you like your meat", "Compliment the food"],
  },
  {
    id: "en-wine-tasting", title: "Wine Tasting", description: "品酒体验",
    role: "Sommelier", userRole: "Customer",
    targetVocabulary: ["vintage", "aroma", "tannin", "dry", "sweet", "full-bodied", "finish", "pairing", "region", "grape"],
    targetGrammar: ["What notes do you get...", "I'm tasting...", "What pairs well with...", "I prefer something..."],
    difficulty: "advanced",
    openingLine: "Welcome to our tasting room. Are you more of a red or white wine person?",
    tips: ["Describe what you taste", "Ask about food pairings", "Compare different wines"],
  },
  // =========================================
  // Work & Study (5 scenes)
  // =========================================
  {
    id: "en-job-interview", title: "Job Interview", description: "工作面试",
    role: "Interviewer", userRole: "Candidate",
    targetVocabulary: ["experience", "strength", "weakness", "teamwork", "deadline", "qualification", "achievement", "goal", "background"],
    targetGrammar: ["I have experience in...", "My biggest strength is...", "I'm good at...", "In my previous role..."],
    difficulty: "advanced",
    openingLine: "Thanks for coming in today. Tell me a little about yourself.",
    tips: ["Give a brief self-intro", "Talk about relevant experience", "Ask about the company"],
  },
  {
    id: "en-meeting", title: "Team Meeting", description: "团队会议",
    role: "Project Manager", userRole: "Team Member",
    targetVocabulary: ["deadline", "milestone", "update", "blocker", "progress", "agenda", "action item", "follow-up", "priority"],
    targetGrammar: ["I've been working on...", "I'm blocked by...", "My update is...", "Could we prioritize..."],
    difficulty: "intermediate",
    openingLine: "Alright team, let's get started. Can everyone give a quick update on where they are?",
    tips: ["Give a concise update", "Mention any blockers", "Ask about priorities"],
  },
  {
    id: "en-negotiation", title: "Salary Negotiation", description: "薪资谈判",
    role: "HR Manager", userRole: "Employee",
    targetVocabulary: ["salary", "raise", "promotion", "compensation", "benefit", "bonus", "market rate", "performance", "counter-offer"],
    targetGrammar: ["Based on my performance...", "I believe I deserve...", "Could we discuss...", "What's the range for..."],
    difficulty: "advanced",
    openingLine: "Thanks for coming in to discuss your compensation. What's on your mind?",
    tips: ["Present your achievements", "Reference market rates", "Be confident but polite"],
  },
  {
    id: "en-presentation", title: "Giving a Presentation", description: "工作汇报演示",
    role: "Colleague (audience)", userRole: "Presenter",
    targetVocabulary: ["slide", "overview", "key point", "data", "conclusion", "Q&A", "chart", "statistic", "takeaway"],
    targetGrammar: ["Let me walk you through...", "As you can see...", "The key takeaway is...", "Any questions so far..."],
    difficulty: "advanced",
    openingLine: "Ready when you are! We're all excited to see what you've prepared.",
    tips: ["Start with an overview", "Explain each slide clearly", "Invite questions at the end"],
  },
  {
    id: "en-study-group", title: "Study Group", description: "学习小组讨论",
    role: "Study Partner", userRole: "Student",
    targetVocabulary: ["assignment", "deadline", "concept", "review", "note", "textbook", "exam", "grade", "study session"],
    targetGrammar: ["I'm struggling with...", "Can you explain...", "Let's review...", "Have you finished..."],
    difficulty: "intermediate",
    openingLine: "Hey! Ready to study? I was thinking we could start with chapter five. How are you feeling about it?",
    tips: ["Ask about confusing concepts", "Share your notes", "Plan the study session"],
  },
  // =========================================
  // Social (5 scenes)
  // =========================================
  {
    id: "en-small-talk", title: "Small Talk at a Party", description: "聚会闲聊",
    role: "Friendly Stranger", userRole: "Party Guest",
    targetVocabulary: ["hobby", "weekend", "weather", "hometown", "profession", "recommend", "interesting", "recently", "favorite"],
    targetGrammar: ["How do you know...", "I've been... lately", "Have you tried...", "What do you think of..."],
    difficulty: "intermediate",
    openingLine: "Hey! Great party, right? I don't think we've met. I'm Alex.",
    tips: ["Introduce yourself", "Ask about their hobbies", "Keep it light and friendly"],
  },
  {
    id: "en-first-date", title: "First Date", description: "初次约会",
    role: "Date", userRole: "Date",
    targetVocabulary: ["hobby", "passion", "travel", "movie", "music", "foodie", "adventurous", "relaxed", "impressed"],
    targetGrammar: ["So what do you do...", "I'm really into...", "Have you ever been to...", "That sounds amazing..."],
    difficulty: "intermediate",
    openingLine: "Hi! So glad we finally met. This place is really nice — have you been here before?",
    tips: ["Ask about their interests", "Share something about yourself", "Keep the conversation balanced"],
  },
  {
    id: "en-making-plans", title: "Making Weekend Plans", description: "商量周末计划",
    role: "Friend", userRole: "Friend",
    targetVocabulary: ["hang out", "movie", "hiking", "brunch", "concert", "available", "rain check", "pick up", "sounds good"],
    targetGrammar: ["What are you up to...", "How about...", "I'm free on...", "Let's meet at..."],
    difficulty: "beginner",
    openingLine: "Hey! Any plans for the weekend? I was thinking we could do something fun.",
    tips: ["Suggest an activity", "Agree on time and place", "Be flexible if they're busy"],
  },
  {
    id: "en-apology", title: "Apologizing to a Friend", description: "向朋友道歉",
    role: "Friend", userRole: "Apologizing Friend",
    targetVocabulary: ["sorry", "regret", "misunderstanding", "overreact", "make it up", "forgive", "honest", "promise", "appreciate"],
    targetGrammar: ["I'm sorry for...", "I shouldn't have...", "I didn't mean to...", "How can I make it up..."],
    difficulty: "intermediate",
    openingLine: "Oh hey... I wasn't sure you'd call. What's up?",
    tips: ["Start with a sincere apology", "Explain without making excuses", "Ask how to make things right"],
  },
  {
    id: "en-giving-advice", title: "Giving Advice", description: "给朋友建议",
    role: "Friend Seeking Advice", userRole: "Friend Giving Advice",
    targetVocabulary: ["dilemma", "option", "pros and cons", "regret", "go for it", "think it through", "trust your gut", "perspective"],
    targetGrammar: ["If I were you...", "Have you considered...", "The way I see it...", "Whatever you decide..."],
    difficulty: "intermediate",
    openingLine: "Hey, can I run something by you? I've got a bit of a dilemma and I could use your advice.",
    tips: ["Listen first before advising", "Present pros and cons", "Be supportive whatever they choose"],
  },
  // =========================================
  // Shopping (4 scenes)
  // =========================================
  {
    id: "en-clothing-store", title: "Clothing Store", description: "服装店购物",
    role: "Sales Assistant", userRole: "Customer",
    targetVocabulary: ["size", "fitting room", "return policy", "discount", "sale", "fabric", "try on", "exchange", "receipt"],
    targetGrammar: ["Do you have this in...", "Can I try this on...", "Where's the fitting room...", "What's your return policy..."],
    difficulty: "beginner",
    openingLine: "Hi! Welcome to Style & Co. Let me know if you need help finding anything!",
    tips: ["Ask about sizes", "Try things on", "Check the return policy"],
  },
  {
    id: "en-electronics", title: "Buying Electronics", description: "买电子产品",
    role: "Tech Salesperson", userRole: "Customer",
    targetVocabulary: ["warranty", "specification", "battery life", "storage", "refurbished", "trade-in", "model", "accessory"],
    targetGrammar: ["What's the difference between...", "How long is the warranty...", "Does it come with...", "Can I trade in..."],
    difficulty: "intermediate",
    openingLine: "Hey there! Looking for something specific, or just browsing?",
    tips: ["Compare different models", "Ask about warranty", "Check if accessories are included"],
  },
  {
    id: "en-farmers-market", title: "Farmers Market", description: "农贸市场",
    role: "Farmer / Vendor", userRole: "Customer",
    targetVocabulary: ["organic", "locally grown", "seasonal", "ripe", "sample", "bundle", "fresh", "pesticide-free", "harvest"],
    targetGrammar: ["Are these organic...", "How much for a bunch...", "Can I try a sample...", "When were these picked..."],
    difficulty: "beginner",
    openingLine: "Morning! Everything on this table was picked fresh this morning. What catches your eye?",
    tips: ["Ask if it's organic", "Try free samples", "Buy seasonal produce"],
  },
  {
    id: "en-online-order", title: "Online Order Return", description: "网购退货",
    role: "Customer Service Rep", userRole: "Customer",
    targetVocabulary: ["refund", "return label", "defective", "exchange", "policy", "shipping", "processing", "confirmation", "tracking"],
    targetGrammar: ["I'd like to return...", "It arrived damaged...", "How long does refund take...", "Can I exchange it for..."],
    difficulty: "intermediate",
    openingLine: "Thank you for calling ShopFast customer service. How can I help you today?",
    tips: ["State your order number", "Explain the issue clearly", "Ask about refund timeline"],
  },
  // =========================================
  // Health (4 scenes)
  // =========================================
  {
    id: "en-doctor", title: "Doctor's Appointment", description: "看病就诊",
    role: "Doctor", userRole: "Patient",
    targetVocabulary: ["symptom", "headache", "sore throat", "fever", "prescription", "appointment", "allergy", "blood test", "recover"],
    targetGrammar: ["I've been feeling...", "It hurts when...", "How long have you...", "You should..."],
    difficulty: "intermediate",
    openingLine: "Good morning. What seems to be the problem today?",
    tips: ["Describe symptoms in detail", "Say when it started", "Ask about treatment"],
  },
  {
    id: "en-pharmacy", title: "At the Pharmacy", description: "药店买药",
    role: "Pharmacist", userRole: "Customer",
    targetVocabulary: ["prescription", "over-the-counter", "dosage", "side effect", "generic", "ointment", "capsule", "refill", "expiration"],
    targetGrammar: ["I need something for...", "Do I need a prescription...", "How often should I take...", "Are there side effects..."],
    difficulty: "intermediate",
    openingLine: "Hi there. Do you have a prescription to fill, or are you looking for something over the counter?",
    tips: ["Describe what's bothering you", "Ask about dosage", "Check for side effects"],
  },
  {
    id: "en-dentist", title: "At the Dentist", description: "牙科诊所",
    role: "Dentist", userRole: "Patient",
    targetVocabulary: ["cavity", "cleaning", "X-ray", "numb", "floss", "sensitive", "wisdom tooth", "braces", "appointment"],
    targetGrammar: ["It hurts when I...", "How often should I...", "Do I need a filling...", "My teeth are sensitive..."],
    difficulty: "intermediate",
    openingLine: "Hi! Have a seat. When was your last dental check-up?",
    tips: ["Describe any pain or sensitivity", "Ask about dental hygiene tips", "Schedule your next visit"],
  },
  {
    id: "en-gym", title: "At the Gym", description: "健身房",
    role: "Personal Trainer", userRole: "Gym Member",
    targetVocabulary: ["workout", "reps", "set", "cardio", "strength", "stretch", "form", "warm-up", "cool-down", "routine"],
    targetGrammar: ["How do I use this...", "Am I doing this right...", "Can you spot me...", "I want to work on..."],
    difficulty: "beginner",
    openingLine: "Hey! Ready for today's workout? What are we focusing on — cardio or strength?",
    tips: ["Ask about proper form", "Tell them your fitness goals", "Ask for a routine"],
  },
  // =========================================
  // Entertainment (3 scenes)
  // =========================================
  {
    id: "en-movie-night", title: "Movie Night", description: "讨论看电影",
    role: "Friend", userRole: "Friend",
    targetVocabulary: ["blockbuster", "review", "trailer", "subtitles", "sold out", "matinee", "premiere", "genre", "plot"],
    targetGrammar: ["Have you seen...", "I heard it's...", "What time is the...", "Let's go see..."],
    difficulty: "beginner",
    openingLine: "Hey! I'm thinking of catching a movie tonight. Have you seen anything good lately?",
    tips: ["Discuss genres you like", "Check showtimes together", "Share movie opinions"],
  },
  {
    id: "en-concert", title: "Buying Concert Tickets", description: "购买演唱会门票",
    role: "Box Office Agent", userRole: "Fan",
    targetVocabulary: ["ticket", "sold out", "nosebleed", "floor seat", "VIP", "merchandise", "opening act", "venue", "resale"],
    targetGrammar: ["Are there any tickets left...", "How much are...", "What section is...", "Is there a presale..."],
    difficulty: "intermediate",
    openingLine: "Welcome to TicketMaster Box Office! Which event are you looking for?",
    tips: ["Specify the artist/event", "Ask about seat options", "Check pricing tiers"],
  },
  {
    id: "en-museum", title: "At the Museum", description: "博物馆参观",
    role: "Museum Guide", userRole: "Visitor",
    targetVocabulary: ["exhibit", "gallery", "audio guide", "masterpiece", "contemporary", "sculpture", "artifact", "admission", "tour"],
    targetGrammar: ["What's on exhibit...", "Is there an audio guide...", "When was this made...", "Can I take photos..."],
    difficulty: "intermediate",
    openingLine: "Welcome to the National Art Museum! Is this your first visit?",
    tips: ["Ask about current exhibits", "Get an audio guide", "Ask about the artwork"],
  },
  // =========================================
  // Emergency (2 scenes)
  // =========================================
  {
    id: "en-lost-item", title: "Lost and Found", description: "丢失物品",
    role: "Lost & Found Staff", userRole: "Person Who Lost Item",
    targetVocabulary: ["lost", "found", "description", "valuable", "claim", "ID", "report", "reward", "contact"],
    targetGrammar: ["I've lost my...", "It looks like...", "Has anyone turned in...", "Where should I check..."],
    difficulty: "beginner",
    openingLine: "Lost and Found office. How can I help you?",
    tips: ["Describe the item clearly", "Say when and where you lost it", "Leave your contact info"],
  },
  {
    id: "en-police", title: "Reporting to Police", description: "报警求助",
    role: "Police Officer", userRole: "Victim / Witness",
    targetVocabulary: ["report", "incident", "suspect", "witness", "stolen", "description", "evidence", "statement", "case number"],
    targetGrammar: ["I'd like to report...", "It happened at...", "I saw someone...", "Can you help me with..."],
    difficulty: "intermediate",
    openingLine: "Good evening. I'm Officer Davis. What can I do for you?",
    tips: ["State what happened clearly", "Give time and location", "Describe the person if you can"],
  },
]

// ============================================================
// 韩语场景
// ============================================================

export const koreanScenes: SceneNode[] = [
  // =========================================
  // Daily Life (5 scenes)
  // =========================================
  {
    id: "ko-coffee-shop", title: "카페에서", description: "咖啡店点单",
    role: "바리스타", userRole: "손님",
    targetVocabulary: ["아메리카노", "카페라떼", "아이스", "따뜻한", "포장", "영수증", "디저트", "사이즈"],
    targetGrammar: ["~주세요", "~로 할게요", "~있나요", "얼마예요", "~드릴까요"],
    difficulty: "beginner",
    openingLine: "어서 오세요! 무엇을 드릴까요?",
    tips: ["음료와 디저트를 주문해 보세요", "사이즈를 물어보세요", "예의 표현을 사용하세요"],
  },
  {
    id: "ko-grocery", title: "마트에서", description: "超市购物",
    role: "직원", userRole: "손님",
    targetVocabulary: ["과일", "야채", "할인", "가격", "계산대", "장바구니", "유통기한", "신선한", "세일"],
    targetGrammar: ["~어디에 있어요", "얼마예요", "~찾고 있어요", "~주세요", "~있나요"],
    difficulty: "beginner",
    openingLine: "안녕하세요! 찾으시는 물건이 있으세요?",
    tips: ["찾는 물건의 위치를 물어보세요", "가격이나 할인을 물어보세요", "양이나 무게를 표현해 보세요"],
  },
  {
    id: "ko-bank", title: "은행에서", description: "银行办理业务",
    role: "은행원", userRole: "손님",
    targetVocabulary: ["계좌", "입금", "출금", "이체", "잔액", "이자", "대출", "신용카드", "비밀번호"],
    targetGrammar: ["~하려고 왔어요", "~도와주세요", "얼마나 걸려요", "수수료가 있나요"],
    difficulty: "intermediate",
    openingLine: "안녕하세요! 어떤 업무를 도와드릴까요?",
    tips: ["하고 싶은 업무를 말하세요", "수수료를 물어보세요", "처리 시간을 확인하세요"],
  },
  {
    id: "ko-library", title: "도서관에서", description: "图书馆借书",
    role: "사서", userRole: "이용자",
    targetVocabulary: ["대출", "반납", "연체", "연장", "도서관 카드", "소설", "자료", "열람실"],
    targetGrammar: ["~책을 찾고 있어요", "빌릴 수 있나요", "언제까지...", "연장할 수 있나요"],
    difficulty: "beginner",
    openingLine: "안녕하세요! 시립 도서관입니다. 무엇을 도와드릴까요?",
    tips: ["찾는 책을 말해 보세요", "대출 기간을 확인하세요", "연장 방법을 물어보세요"],
  },
  {
    id: "ko-post-office", title: "우체국에서", description: "邮局寄件",
    role: "우체국 직원", userRole: "손님",
    targetVocabulary: ["소포", "등기", "빠른", "보통", "주소", "우편번호", "무게", "배송", "추적"],
    targetGrammar: ["~보내려고 해요", "얼마나 걸려요", "얼마예요", "~로 보내주세요"],
    difficulty: "beginner",
    openingLine: "안녕하세요! 무엇을 보내시려고 오셨어요?",
    tips: ["보낼 물건과 목적지를 말하세요", "빠른 우편인지 물어보세요", "배송 시간을 확인하세요"],
  },
  // =========================================
  // Travel (4 scenes)
  // =========================================
  {
    id: "ko-hotel", title: "호텔 체크인", description: "酒店入住",
    role: "호텔 직원", userRole: "투숙객",
    targetVocabulary: ["예약", "체크인", "체크아웃", "열쇠", "짐", "조식", "무료", "방", "모닝콜"],
    targetGrammar: ["~로 예약했어요", "~주시겠어요", "몇 시에...", "~포함되어 있나요"],
    difficulty: "beginner",
    openingLine: "안녕하세요! 그랜드 호텔에 오신 것을 환영합니다. 예약하셨나요?",
    tips: ["예약자 이름을 말해 보세요", "조식과 와이파이를 물어보세요", "필요한 것을 부탁해 보세요"],
  },
  {
    id: "ko-airport", title: "공항에서", description: "机场值机",
    role: "항공사 직원", userRole: "승객",
    targetVocabulary: ["탑승권", "수하물", "기내", "출발", "게이트", "지연", "여권", "좌석"],
    targetGrammar: ["~로 가요", "짐이...", "몇 시에...", "어느 게이트..."],
    difficulty: "intermediate",
    openingLine: "다음 분! 어디로 가시나요?",
    tips: ["목적지를 말하세요", "수하물 개수를 확인하세요", "게이트와 탑승 시간을 확인하세요"],
  },
  {
    id: "ko-taxi", title: "택시 타기", description: "打车出行",
    role: "택시 기사", userRole: "승객",
    targetVocabulary: ["목적지", "요금", "미터기", "길", "교통", "내려주세요", "트렁크", "영수증"],
    targetGrammar: ["~로 가주세요", "얼마나 걸려요", "여기서 내려주세요", "미터기 켜주세요"],
    difficulty: "beginner",
    openingLine: "어서 타세요! 어디로 갈까요?",
    tips: ["목적지를 말하세요", "요금을 물어보세요", "내릴 곳을 알려주세요"],
  },
  {
    id: "ko-subway", title: "지하철 타기", description: "乘坐地铁",
    role: "역무원", userRole: "승객",
    targetVocabulary: ["승강장", "환승", "노선", "급행", "일반", "교통카드", "출구", "막차"],
    targetGrammar: ["~가는 길이...", "어디서 갈아타요", "몇 정거장...", "몇 번 출구..."],
    difficulty: "beginner",
    openingLine: "어디 가시는 길이에요? 도와드릴까요?",
    tips: ["가는 곳을 말하세요", "환승역을 확인하세요", "출구 번호를 물어보세요"],
  },
  // =========================================
  // Food & Dining (4 scenes)
  // =========================================
  {
    id: "ko-restaurant", title: "식당에서", description: "餐厅点餐",
    role: "종업원", userRole: "손님",
    targetVocabulary: ["메뉴", "추천", "맛있는", "매운", "계산서", "반찬", "주문", "더", "덜"],
    targetGrammar: ["~주세요", "~추천해 주세요", "~맛있어요", "~덜 맵게 해주세요", "계산해 주세요"],
    difficulty: "beginner",
    openingLine: "어서 오세요! 몇 분이세요? 메뉴판 드릴게요.",
    tips: ["음식을 주문해 보세요", "종업원에게 추천을 물어보세요", "맵기 조절을 부탁해 보세요"],
  },
  {
    id: "ko-street-food", title: "길거리 음식", description: "街头小吃",
    role: "포장마차 주인", userRole: "손님",
    targetVocabulary: ["떡볶이", "순대", "어묵", "튀김", "매콤한", "달콤한", "국물", "서비스"],
    targetGrammar: ["~주세요", "~맛있어 보여요", "~얼마예요", "~더 주세요"],
    difficulty: "beginner",
    openingLine: "어서 오세요! 뭐 드릴까요? 떡볶이는 방금 만들었어요!",
    tips: ["먹고 싶은 음식을 말하세요", "맛을 물어보세요", "가격을 확인하세요"],
  },
  {
    id: "ko-bbq", title: "고깃집에서", description: "韩式烤肉",
    role: "직원", userRole: "손님",
    targetVocabulary: ["삼겹살", "목살", "된장찌개", "쌈", "상추", "마늘", "소주", "추가"],
    targetGrammar: ["~인분 주세요", "~더 주세요", "불판 갈아주세요", "~추가해 주세요"],
    difficulty: "beginner",
    openingLine: "어서 오세요! 몇 인분 드릴까요?",
    tips: ["고기 종류와 인분을 말하세요", "추가 주문을 해보세요", "반찬 리필을 부탁해 보세요"],
  },
  {
    id: "ko-delivery", title: "배달 주문", description: "外卖点餐",
    role: "가게 직원", userRole: "주문자",
    targetVocabulary: ["배달", "주소", "전화번호", "메뉴", "추가", "도착", "시간", "카드"],
    targetGrammar: ["~배달 되나요", "~로 주문할게요", "얼마나 걸려요", "~빼주세요"],
    difficulty: "beginner",
    openingLine: "네, OO치킨입니다. 주문 도와드릴까요?",
    tips: ["주소와 전화번호를 말하세요", "메뉴와 수량을 말하세요", "배달 시간을 확인하세요"],
  },
  // =========================================
  // Work & Study (4 scenes)
  // =========================================
  {
    id: "ko-interview", title: "면접", description: "韩语面试",
    role: "면접관", userRole: "지원자",
    targetVocabulary: ["경력", "장점", "단점", "팀워크", "목표", "전공", "성취", "지원 동기"],
    targetGrammar: ["~경험이 있습니다", "제 장점은...", "~잘합니다", "지원한 이유는..."],
    difficulty: "advanced",
    openingLine: "안녕하세요. 자기소개 부탁드립니다.",
    tips: ["간단히 자기소개 하세요", "관련 경험을 말하세요", "회사에 대해 질문하세요"],
  },
  {
    id: "ko-meeting", title: "회의", description: "团队会议",
    role: "팀장", userRole: "팀원",
    targetVocabulary: ["마감", "진행", "보고", "이슈", "계획", "회의록", "다음", "확인"],
    targetGrammar: ["~진행 중입니다", "~문제가 있습니다", "~완료했습니다", "~논의해 봅시다"],
    difficulty: "intermediate",
    openingLine: "자, 다들 모이셨죠? 각자 진행 상황 공유해 주세요.",
    tips: ["진행 상황을 간단히 말하세요", "문제점이 있으면 말하세요", "다음 계획을 말하세요"],
  },
  {
    id: "ko-class", title: "수업 시간", description: "课堂讨论",
    role: "교수님", userRole: "학생",
    targetVocabulary: ["과제", "발표", "질문", "설명", "이해", "복습", "시험", "성적"],
    targetGrammar: ["질문 있어요", "~잘 모르겠어요", "다시 설명해 주세요", "언제까지..."],
    difficulty: "intermediate",
    openingLine: "오늘은 지난 시간에 배운 내용을 복습해 볼게요. 질문 있는 사람?",
    tips: ["모르는 것을 물어보세요", "설명을 부탁해 보세요", "과제 마감일을 확인하세요"],
  },
  {
    id: "ko-study", title: "스터디 모임", description: "学习小组",
    role: "스터디 친구", userRole: "학생",
    targetVocabulary: ["공부", "노트", "복습", "문제", "시험", "설명", "도움", "함께"],
    targetGrammar: ["~어려워요", "~설명해 주세요", "같이...", "~도와줄 수 있어요"],
    difficulty: "beginner",
    openingLine: "안녕! 공부할 준비됐어? 오늘 어디부터 시작할까?",
    tips: ["어려운 부분을 말하세요", "서로 설명해 보세요", "공부 계획을 세워보세요"],
  },
  // =========================================
  // Social (4 scenes)
  // =========================================
  {
    id: "ko-introduction", title: "자기소개", description: "初次见面",
    role: "새로운 친구", userRole: "자기",
    targetVocabulary: ["이름", "취미", "직업", "전공", "고향", "좋아하다", "처음", "반갑다", "친구"],
    targetGrammar: ["~입니다/이에요", "~에서 왔어요", "~좋아해요", "~전공이에요", "만나서 반갑습니다"],
    difficulty: "beginner",
    openingLine: "안녕하세요! 처음 뵙겠습니다. 저는 수진이라고 해요.",
    tips: ["이름과 고향을 소개하세요", "취미나 전공을 말해 보세요", "상대방에게도 질문하세요"],
  },
  {
    id: "ko-plans", title: "약속 잡기", description: "约定计划",
    role: "친구", userRole: "친구",
    targetVocabulary: ["약속", "주말", "영화", "저녁", "시간", "장소", "만나다", "바쁘다", "괜찮다"],
    targetGrammar: ["~에 만날까요", "~어때요", "몇 시에...", "~에서 볼까요"],
    difficulty: "beginner",
    openingLine: "야! 이번 주말에 시간 있어? 오랜만에 만나면 좋겠다.",
    tips: ["약속 시간과 장소를 정하세요", "하고 싶은 것을 제안하세요", "상대방 의견도 물어보세요"],
  },
  {
    id: "ko-advice", title: "고민 상담", description: "倾诉烦恼",
    role: "고민 있는 친구", userRole: "조언하는 친구",
    targetVocabulary: ["고민", "결정", "걱정", "조언", "생각", "도움", "응원", "힘내"],
    targetGrammar: ["~고민이 있어", "어떻게 생각해", "내 생각에는...", "~해 보는 게 어때"],
    difficulty: "intermediate",
    openingLine: "있잖아... 요즘 좀 고민이 있어서. 잠깐 이야기 좀 할 수 있을까?",
    tips: ["잘 들어주고 공감하세요", "자신의 생각을 말해 보세요", "격려의 말을 해주세요"],
  },
  {
    id: "ko-compliment", title: "칭찬하기", description: "赞美他人",
    role: "동료", userRole: "칭찬하는 사람",
    targetVocabulary: ["잘하다", "멋지다", "예쁘다", "대단하다", "부럽다", "노력", "재능", "스타일"],
    targetGrammar: ["~잘하시네요", "~멋져요", "~예뻐요", "어떻게 그렇게..."],
    difficulty: "beginner",
    openingLine: "아, 안녕하세요! 요즘 정말 열심히 하시는 것 같아요.",
    tips: ["진심으로 칭찬하세요", "구체적으로 말하세요", "상대방 반응을 살피세요"],
  },
  // =========================================
  // Shopping (3 scenes)
  // =========================================
  {
    id: "ko-clothing", title: "옷 가게에서", description: "服装店购物",
    role: "직원", userRole: "손님",
    targetVocabulary: ["사이즈", "탈의실", "환불", "교환", "할인", "세일", "색상", "입어보다"],
    targetGrammar: ["~있나요", "입어봐도 돼요", "탈의실이 어디...", "교환 가능한가요"],
    difficulty: "beginner",
    openingLine: "어서 오세요! 찾으시는 스타일 있으세요?",
    tips: ["원하는 사이즈를 물어보세요", "입어보고 결정하세요", "교환/환불 정책을 확인하세요"],
  },
  {
    id: "ko-cosmetics", title: "화장품 가게에서", description: "化妆品店",
    role: "직원", userRole: "손님",
    targetVocabulary: ["스킨케어", "화장품", "피부", "톤", "촉촉한", "자외선", "샘플", "테스트"],
    targetGrammar: ["~추천해 주세요", "~타입이에요", "발라봐도 돼요", "샘플 있나요"],
    difficulty: "intermediate",
    openingLine: "안녕하세요! 피부 타입이 어떻게 되세요?",
    tips: ["피부 타입을 말하세요", "원하는 제품을 말하세요", "샘플을 요청해 보세요"],
  },
  {
    id: "ko-online", title: "인터넷 쇼핑", description: "网上购物",
    role: "고객센터 직원", userRole: "고객",
    targetVocabulary: ["주문", "배송", "환불", "교환", "취소", "확인", "문의", "불량"],
    targetGrammar: ["~주문했는데요", "~언제 도착해요", "환불하고 싶어요", "~교환 가능한가요"],
    difficulty: "intermediate",
    openingLine: "OO쇼핑 고객센터입니다. 무엇을 도와드릴까요?",
    tips: ["주문 번호를 말하세요", "문제를 설명하세요", "원하는 해결 방법을 말하세요"],
  },
  // =========================================
  // Health (2 scenes)
  // =========================================
  {
    id: "ko-hospital", title: "병원에서", description: "看病就诊",
    role: "의사 선생님", userRole: "환자",
    targetVocabulary: ["증상", "두통", "열", "기침", "처방", "약", "검사", "예약", "접수"],
    targetGrammar: ["~아파요", "언제부터...", "~먹어야 해요", "며칠 동안..."],
    difficulty: "intermediate",
    openingLine: "안녕하세요. 어디가 불편해서 오셨어요?",
    tips: ["증상을 자세히 말하세요", "언제부터 아팠는지 말하세요", "처방에 대해 물어보세요"],
  },
  {
    id: "ko-pharmacy", title: "약국에서", description: "药店买药",
    role: "약사", userRole: "손님",
    targetVocabulary: ["처방전", "약", "복용", "식후", "식전", "부작용", "하루", "증상"],
    targetGrammar: ["~약 있어요", "어떻게 먹어요", "처방전 필요해요", "부작용이..."],
    difficulty: "beginner",
    openingLine: "안녕하세요. 처방전 있으세요? 아니면 필요한 약을 말씀해 주세요.",
    tips: ["증상을 말하거나 처방전을 보여주세요", "복용법을 확인하세요", "부작용을 물어보세요"],
  },
]

// ============================================================
// System Prompt 模板
// ============================================================

/**
 * 陪练Agent System Prompt 生成器
 * 根据场景动态生成陪练Agent的System Prompt
 */
export function generatePracticeAgentPrompt(scene: SceneNode, language: "en" | "ko"): string {
  const vocab = (scene.targetVocabulary ?? []).join(", ") || "(use natural vocabulary for this scenario)"
  const grammar = (scene.targetGrammar ?? []).join(", ") || "(use natural grammar for this scenario)"
  const difficulty = scene.difficulty ?? "beginner"

  const langInstruction = language === "en"
    ? `You are a ${scene.role} in a ${scene.title} scenario. The user is a ${scene.userRole} who is learning English.
Your job is to have a natural conversation while helping them practice English.

IMPORTANT RULES:
1. Stay in character as a ${scene.role}. Be friendly and natural.
2. Guide the conversation through the scenario naturally.
3. Use the target vocabulary naturally in conversation: ${vocab}
4. Focus on these grammar points: ${grammar}
5. Keep your responses SHORT (1-3 sentences). This is a conversation, not a lecture.
6. If the user struggles, gently rephrase or simplify what you said.
7. If the user says something incorrect, DON'T correct them directly — instead, respond using the correct form naturally.
8. Match the user's level. This is a ${difficulty} level conversation.
9. End each response with a natural follow-up question to keep the conversation flowing.
10. DO NOT use Chinese. Always reply in English only.`
    : `당신은 "${scene.title}" 시나리오의 ${scene.role}입니다. 사용자는 한국어를 배우는 ${scene.userRole}입니다.
자연스러운 대화를 통해 사용자의 한국어 연습을 도와주세요.

중요 규칙:
1. ${scene.role} 역할에 충실하세요. 친절하고 자연스럽게 대화하세요.
2. 시나리오에 맞게 자연스럽게 대화를 진행하세요.
3. 대화 중 자연스럽게 다음 어휘를 사용하세요: ${vocab}
4. 다음 문법 포인트에 집중하세요: ${grammar}
5. 답변은 짧게 (1-3문장). 강의가 아니라 대화입니다.
6. 사용자가 어려워하면 더 쉬운 표현으로 바꿔 말해주세요.
7. 사용자의 오류를 직접 지적하지 말고, 올바른 표현으로 자연스럽게 응답하세요.
8. 사용자 수준에 맞춰주세요. 이 대화는 ${difficulty} 수준입니다.
9. 대화가 계속되도록 자연스러운 후속 질문으로 답변을 마무리하세요.
10. 중국어를 사용하지 마세요. 항상 한국어로만 답변하세요.`

  return langInstruction
}

/**
 * 批改监督Agent System Prompt 生成器
 */
export function generateCoachAgentPrompt(language: "en" | "ko"): string {
  const baseRules = language === "en"
    ? `You are a language learning coach analyzing a student's conversation. Your job is to identify errors and learning opportunities WITHOUT interrupting the conversation flow.

ERROR DETECTION RULES:
- CRITICAL (immediate feedback needed): subject-verb agreement errors, tense errors, completely wrong word usage
- MINOR (note for later): article omissions, preposition mistakes, slightly unnatural phrasing
- PRONUNCIATION (note only): flag words that are commonly mispronounced (can't verify actual pronunciation from text)

FOR EACH ANALYSIS, OUTPUT ONLY A JSON OBJECT:
{
  "errors": [
    {
      "type": "grammar" | "vocabulary" | "pronunciation",
      "severity": "critical" | "minor",
      "original": "what the student said",
      "correction": "correct version",
      "explanation": "brief explanation in Chinese"
    }
  ],
  "newVocabulary": [
    {
      "word": "word or phrase",
      "phonetic": "pronunciation guide",
      "meaning": "Chinese meaning",
      "example": "example sentence"
    }
  ],
  "stats": {
    "accuracy": 0-100,
    "fluency": 1-5,
    "nervousness": "low" | "medium" | "high"
  }
}

IMPORTANT:
- Do NOT output anything except valid JSON
- If no errors found, output empty errors array
- Only suggest vocabulary that is RELEVANT to the current conversation topic
- accuracy = percentage of grammatically correct sentences
- fluency = based on sentence variety and natural flow (1=very choppy, 5=very natural)
- nervousness = based on hesitation markers and self-corrections`
    : `당신은 학생의 한국어 대화를 분석하는 언어 학습 코치입니다. 대화 흐름을 방해하지 않고 오류와 학습 기회를 찾아내는 것이 임무입니다.

오류 감지 규칙:
- 심각 (즉시 피드백 필요): 주어-술어 불일치, 시제 오류, 완전히 잘못된 단어 사용
- 경미 (나중에 기록): 조사 누락, 어색한 표현, 경어법 실수
- 발음 (참고만): 일반적으로 잘못 발음되기 쉬운 단어 표시 (텍스트만으로 실제 발음 확인 불가)

각 분석마다 JSON 객체만 출력하세요:
{
  "errors": [
    {
      "type": "grammar" | "vocabulary" | "pronunciation",
      "severity": "critical" | "minor",
      "original": "학생이 말한 내용",
      "correction": "올바른 표현",
      "explanation": "중국어로 된 간단한 설명"
    }
  ],
  "newVocabulary": [
    {
      "word": "단어나 표현",
      "phonetic": "발음 가이드",
      "meaning": "중국어 의미",
      "example": "예문"
    }
  ],
  "stats": {
    "accuracy": 0-100,
    "fluency": 1-5,
    "nervousness": "low" | "medium" | "high"
  }
}

중요:
- 유효한 JSON 이외의 어떤 것도 출력하지 마세요
- 오류가 없으면 빈 errors 배열 출력
- 현재 대화 주제와 관련된 어휘만 제안
- accuracy = 문법적으로 올바른 문장의 비율
- fluency = 문장 다양성과 자연스러움 기준 (1=매우 부자연, 5=매우 자연)
- nervousness = 망설임 표시와 자기 수정 빈도 기준`

  return baseRules
}
