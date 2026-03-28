const db = require('./db');

const now = new Date();
const daysAgo = (n) => {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

// Clear existing data
db.exec(`
  DELETE FROM email_activities;
  DELETE FROM follow_ups;
  DELETE FROM status_history;
  DELETE FROM applications;
  DELETE FROM resumes;
`);

// Seed resumes
const insertResume = db.prepare(`
  INSERT INTO resumes (name, filename, original_name, tags, file_size, is_master, created_at)
  VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
`);

const masterResume = insertResume.run(
  'Master Resume 2025', 'master_resume.pdf', 'Andrew_Loniewski_Resume_2025.pdf',
  JSON.stringify(['consulting', 'strategy', 'operations']), 245000, 1
);
const consultingResume = insertResume.run(
  'Consulting & Strategy', 'consulting_resume.pdf', 'Andrew_Loniewski_Consulting_2025.pdf',
  JSON.stringify(['consulting', 'strategy', 'mckinsey', 'bcg']), 230000, 0
);
const fintechResume = insertResume.run(
  'Fintech & Risk', 'fintech_resume.pdf', 'Andrew_Loniewski_Fintech_2025.pdf',
  JSON.stringify(['fintech', 'risk', 'banking']), 228000, 0
);
const productResume = insertResume.run(
  'Product & Operations', 'product_resume.pdf', 'Andrew_Loniewski_Product_2025.pdf',
  JSON.stringify(['product', 'operations', 'tech']), 222000, 0
);

// Seed applications
const insertApp = db.prepare(`
  INSERT INTO applications (
    company, job_title, application_link, job_description, location,
    salary_range, application_date, status, source, resume_version_id,
    cover_letter, recruiter_name, recruiter_email, follow_up_date,
    interview_date, notes, priority, compensation_notes, referral_used,
    rejection_reason, created_at, updated_at
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now')
  )
`);

const apps = [
  {
    company: 'McKinsey & Company',
    job_title: 'Associate — Business & Financial Strategy',
    link: 'https://www.mckinsey.com/careers/search-jobs',
    description: `McKinsey & Company is seeking an Associate to join our Business & Financial Strategy practice. You will work with senior clients on their most complex strategic challenges, conduct rigorous analysis, and develop actionable recommendations. You will collaborate with teams across industries including financial services, healthcare, and technology.

Key Responsibilities:
- Lead client engagements and manage workstreams independently
- Conduct quantitative and qualitative analysis to solve complex business problems
- Develop and present recommendations to C-suite executives
- Build client relationships and identify new opportunities
- Mentor junior team members

Requirements:
- MBA from a top-tier institution or equivalent experience
- 3-5 years of relevant work experience
- Strong analytical and problem-solving skills
- Excellent communication and presentation skills
- Willingness to travel up to 80%`,
    location: 'New York, NY',
    salary: '$175,000 - $220,000 + bonus',
    date: daysAgo(21),
    status: 'Interview Round 2',
    source: 'Company Site',
    resume_id: consultingResume.lastInsertRowid,
    cover_letter: 'Tailored cover letter emphasizing EY advisory experience',
    recruiter: 'Sarah Chen',
    recruiter_email: 'sarah.chen@mckinsey.com',
    follow_up: daysAgo(-2),
    interview: daysAgo(-2),
    notes: 'Strong first round — case went well. Second round with Partner on Thursday. Prep Bain-style cases.',
    priority: 'high',
    comp_notes: 'Base $175k + performance bonus ~25%. Signing bonus ~$30k.',
    referral: 1,
    rejection: ''
  },
  {
    company: 'BCG (Boston Consulting Group)',
    job_title: 'Consultant — Financial Institutions',
    link: 'https://careers.bcg.com',
    description: `Boston Consulting Group is looking for a Consultant to join the Financial Institutions practice. This role focuses on strategy and transformation projects for banks, insurance companies, and asset managers.

Responsibilities:
- Drive strategic and operational transformations for financial services clients
- Analyze market trends and competitive landscapes
- Structure and solve complex quantitative problems
- Communicate insights to senior stakeholders

Qualifications:
- MBA or advanced degree preferred
- Consulting or financial services background
- Strong Excel and PowerPoint skills
- Ability to work in fast-paced client environments`,
    location: 'Boston, MA (flexible)',
    salary: '$165,000 - $210,000',
    date: daysAgo(18),
    status: 'Recruiter Screen',
    source: 'LinkedIn',
    resume_id: consultingResume.lastInsertRowid,
    cover_letter: '',
    recruiter: 'James Park',
    recruiter_email: 'jpark@bcg.com',
    follow_up: daysAgo(-1),
    interview: null,
    notes: 'Recruiter screen scheduled for next week. Prepare BCG case examples.',
    priority: 'high',
    comp_notes: 'Comparable to McKinsey offer',
    referral: 0,
    rejection: ''
  },
  {
    company: 'Stripe',
    job_title: 'Strategy & Operations Manager',
    link: 'https://stripe.com/jobs',
    description: `Stripe is hiring a Strategy & Operations Manager to help scale our go-to-market operations. You'll work closely with leadership to define and execute growth strategy.

What you'll do:
- Partner with executive team on strategic planning
- Build operational frameworks to improve efficiency
- Analyze data to identify growth opportunities
- Own cross-functional initiatives from conception to execution

Who you are:
- 4-7 years of experience in consulting, investment banking, or operations
- Data-driven with strong analytical skills
- Excellent communicator and collaborative partner
- Comfortable with ambiguity and fast pace`,
    location: 'San Francisco, CA (Hybrid)',
    salary: '$160,000 - $195,000 + equity',
    date: daysAgo(14),
    status: 'Applied',
    source: 'Company Site',
    resume_id: productResume.lastInsertRowid,
    cover_letter: 'Wrote custom cover letter highlighting fintech ops experience',
    recruiter: '',
    recruiter_email: '',
    follow_up: daysAgo(-7),
    interview: null,
    notes: 'Applied via website. Great JD match — fintech + ops focus.',
    priority: 'high',
    comp_notes: 'Base + significant equity. Target total comp $250k+',
    referral: 0,
    rejection: ''
  },
  {
    company: 'Capital One',
    job_title: 'Senior Manager, Risk Strategy',
    link: 'https://www.capitalone.com/careers',
    description: `Capital One is seeking a Senior Manager to lead risk strategy initiatives within our Cards & Banking division. This role will drive enterprise risk decisions using data analytics and strategic frameworks.

Core Responsibilities:
- Develop and implement credit and operational risk strategies
- Lead a team of analysts to monitor portfolio risk metrics
- Partner with credit, finance, and technology teams
- Present risk assessments to senior leadership and regulators

Requirements:
- 5+ years in risk, finance, or strategy roles
- Experience with credit risk modeling
- Strong leadership and communication skills
- Knowledge of regulatory frameworks (Basel III, CECL)`,
    location: 'McLean, VA (Hybrid)',
    salary: '$145,000 - $175,000 + bonus',
    date: daysAgo(12),
    status: 'Interview Round 1',
    source: 'LinkedIn',
    resume_id: fintechResume.lastInsertRowid,
    cover_letter: '',
    recruiter: 'Michelle Torres',
    recruiter_email: 'michelle.torres@capitalone.com',
    follow_up: null,
    interview: daysAgo(-3),
    notes: 'First round behavioral went well. Technical risk case coming up.',
    priority: 'medium',
    comp_notes: 'Base $160k, annual bonus 15-20%',
    referral: 1,
    rejection: ''
  },
  {
    company: 'Goldman Sachs',
    job_title: 'VP — Transaction Banking',
    link: 'https://www.goldmansachs.com/careers',
    description: `Goldman Sachs Transaction Banking is seeking a Vice President to drive client acquisition and manage strategic relationships with corporate treasury clients.

Responsibilities:
- Manage a portfolio of corporate clients and their cash management needs
- Lead RFP processes and pitch new mandates
- Collaborate with product teams to develop solutions
- Represent the firm at industry events

Requirements:
- 6-10 years in transaction banking or treasury
- Deep knowledge of cash management products
- CFA or equivalent preferred
- Strong client relationship skills`,
    location: 'New York, NY',
    salary: '$200,000 - $250,000 + bonus',
    date: daysAgo(10),
    status: 'Applied',
    source: 'Recruiter',
    resume_id: fintechResume.lastInsertRowid,
    cover_letter: '',
    recruiter: 'David Kim',
    recruiter_email: 'david.kim@gs.com',
    follow_up: daysAgo(-7),
    interview: null,
    notes: 'Reached out by headhunter. Submitted via recruiter.',
    priority: 'high',
    comp_notes: 'Total comp target $300k+ all-in with bonus',
    referral: 0,
    rejection: ''
  },
  {
    company: 'Airbnb',
    job_title: 'Senior Strategy Manager, Experiences',
    link: 'https://careers.airbnb.com',
    description: `Airbnb is looking for a Senior Strategy Manager to help shape the future of our Experiences product. You will develop market entry strategies, competitive analysis, and work with cross-functional teams to drive growth.

Your Impact:
- Lead strategic analysis for Experiences expansion into new markets
- Develop frameworks for pricing and supply optimization
- Partner with product, marketing, and finance on annual planning
- Create board-ready presentations on strategic initiatives

About You:
- 5+ years in strategy, consulting, or corporate development
- Experience in marketplace businesses preferred
- Strong quantitative and qualitative analytical skills`,
    location: 'San Francisco, CA',
    salary: '$150,000 - $190,000 + equity',
    date: daysAgo(8),
    status: 'Interested',
    source: 'LinkedIn',
    resume_id: productResume.lastInsertRowid,
    cover_letter: '',
    recruiter: '',
    recruiter_email: '',
    follow_up: null,
    interview: null,
    notes: 'Great fit for consulting background. Prepare marketplace case studies.',
    priority: 'medium',
    comp_notes: '',
    referral: 0,
    rejection: ''
  },
  {
    company: 'JPMorgan Chase',
    job_title: 'Executive Director — Commercial Banking Strategy',
    link: 'https://careers.jpmorgan.com',
    description: `JPMorgan Chase is hiring an Executive Director to lead strategic initiatives within Commercial Banking. This role involves owning key analytical frameworks, advising senior leadership, and driving transformation programs.

Key Responsibilities:
- Develop strategic plans for Commercial Banking growth priorities
- Lead financial modeling and business case development
- Coordinate with product, technology, and risk partners
- Manage and develop a team of analysts and associates

Required Qualifications:
- 8+ years in banking, consulting, or strategy
- Deep understanding of commercial banking products
- Strong leadership capabilities`,
    location: 'New York, NY',
    salary: '$180,000 - $230,000',
    date: daysAgo(7),
    status: 'Recruiter Screen',
    source: 'Referral',
    resume_id: fintechResume.lastInsertRowid,
    cover_letter: 'Brief cover note emphasizing EY financial services experience',
    recruiter: 'Patricia Nguyen',
    recruiter_email: 'patricia.x.nguyen@chase.com',
    follow_up: daysAgo(-3),
    interview: null,
    notes: 'Referred by former colleague. Recruiter screen this Friday.',
    priority: 'high',
    comp_notes: 'Total comp likely $280k+ with MD track',
    referral: 1,
    rejection: ''
  },
  {
    company: 'Plaid',
    job_title: 'Head of Business Operations',
    link: 'https://plaid.com/careers',
    description: `Plaid is seeking a Head of Business Operations to scale our operational infrastructure as we grow internationally. You'll partner directly with the CEO and COO.

Responsibilities:
- Own company-wide operational planning and OKR processes
- Identify and eliminate operational bottlenecks
- Build scalable operational systems and processes
- Lead cross-functional strategic initiatives

What We're Looking For:
- 7+ years in operations or strategy
- Experience at a high-growth startup or top consulting firm
- Excellent at building systems and driving accountability`,
    location: 'San Francisco, CA (Remote OK)',
    salary: '$170,000 - $210,000 + equity',
    date: daysAgo(5),
    status: 'Planning to Apply',
    source: 'LinkedIn',
    resume_id: productResume.lastInsertRowid,
    cover_letter: '',
    recruiter: '',
    recruiter_email: '',
    follow_up: null,
    interview: null,
    notes: 'Tailor resume to highlight ops leadership. Need to write cover letter.',
    priority: 'medium',
    comp_notes: 'Equity could be substantial at Plaid scale',
    referral: 0,
    rejection: ''
  },
  {
    company: 'Deloitte',
    job_title: 'Senior Manager — Financial Services M&A',
    link: 'https://jobs.deloitte.com',
    description: `Deloitte is seeking a Senior Manager to support financial services M&A transactions including due diligence, integration planning, and value creation programs.

Role Overview:
- Lead buy-side and sell-side financial due diligence
- Develop integration strategies for M&A transactions
- Manage client relationships and project teams
- Build proposals and develop new business

Qualifications:
- CPA or CFA preferred
- 7+ years in M&A advisory or corporate development
- Financial services sector expertise`,
    location: 'New York, NY',
    salary: '$155,000 - $190,000',
    date: daysAgo(4),
    status: 'Applied',
    source: 'Company Site',
    resume_id: consultingResume.lastInsertRowid,
    cover_letter: '',
    recruiter: 'Kevin Walsh',
    recruiter_email: 'kwalsh@deloitte.com',
    follow_up: daysAgo(-14),
    interview: null,
    notes: 'Big 4 overlap — emphasize client leadership and deal experience.',
    priority: 'low',
    comp_notes: '',
    referral: 0,
    rejection: ''
  },
  {
    company: 'Figma',
    job_title: 'Director of Strategy & Corporate Development',
    link: 'https://www.figma.com/careers',
    description: `Figma is looking for a Director of Strategy and Corporate Development to help shape long-term company direction, evaluate strategic investments, and lead M&A processes.

What You'll Do:
- Develop and maintain long-range strategic plans
- Evaluate partnership, investment, and acquisition opportunities
- Lead due diligence and integration for acquisitions
- Work directly with CEO and CFO on strategic decisions

About You:
- Investment banking or corporate development background
- 7-10 years of relevant experience
- Strong financial modeling skills
- Proven ability to close deals`,
    location: 'San Francisco, CA',
    salary: '$180,000 - $220,000 + equity',
    date: daysAgo(3),
    status: 'Interested',
    source: 'LinkedIn',
    resume_id: productResume.lastInsertRowid,
    cover_letter: '',
    recruiter: '',
    recruiter_email: '',
    follow_up: null,
    interview: null,
    notes: 'Dream role. Need strong cover letter and maybe LinkedIn connection first.',
    priority: 'medium',
    comp_notes: 'Figma equity could be significant post-IPO',
    referral: 0,
    rejection: ''
  },
  {
    company: 'Oliver Wyman',
    job_title: 'Engagement Manager — Risk & Regulatory',
    link: 'https://www.oliverwyman.com/careers.html',
    description: `Oliver Wyman is seeking an Engagement Manager to lead client engagements in our Risk & Regulatory practice serving banks, insurers, and asset managers.

Responsibilities:
- Lead project delivery and manage client relationships
- Develop risk frameworks and regulatory compliance strategies
- Supervise consultant teams
- Support business development

Requirements:
- MBA or equivalent advanced degree
- 5+ years in consulting or financial services
- Experience with Basel, DFAST, or CCAR preferred`,
    location: 'New York, NY',
    salary: '$175,000 - $215,000',
    date: daysAgo(2),
    status: 'Final Round',
    source: 'Recruiter',
    resume_id: consultingResume.lastInsertRowid,
    cover_letter: 'Submitted strong cover letter via recruiter',
    recruiter: 'Lisa Brennan',
    recruiter_email: 'lisa.brennan@oliverwyman.com',
    follow_up: null,
    interview: daysAgo(-1),
    notes: 'Final round tomorrow with two Partners. Prepare 3 strong case examples. Very positive signals.',
    priority: 'high',
    comp_notes: 'Competitive with McKinsey offer',
    referral: 0,
    rejection: ''
  },
  {
    company: 'Amazon',
    job_title: 'Senior Product Manager — AWS Financial Services',
    link: 'https://www.amazon.jobs',
    description: `Amazon Web Services is seeking a Senior Product Manager to define and drive the product roadmap for financial services industry solutions.

Responsibilities:
- Own the product vision for AWS Financial Services vertical
- Work with customers to understand needs and translate into features
- Collaborate with engineering and design teams
- Track and analyze key performance metrics

Basic Qualifications:
- 5+ years of product management experience
- Financial services domain expertise
- Strong written and verbal communication`,
    location: 'Seattle, WA (Hybrid)',
    salary: '$155,000 - $200,000 + RSUs',
    date: daysAgo(6),
    status: 'Rejected',
    source: 'LinkedIn',
    resume_id: productResume.lastInsertRowid,
    cover_letter: '',
    recruiter: '',
    recruiter_email: '',
    follow_up: null,
    interview: null,
    notes: 'Auto-rejected after 6 days. Role may have been filled internally.',
    priority: 'low',
    comp_notes: '',
    referral: 0,
    rejection: 'Automated rejection — likely internal candidate'
  },
  {
    company: 'Bain & Company',
    job_title: 'Case Team Leader',
    link: 'https://www.bain.com/careers',
    description: `Bain & Company is looking for a Case Team Leader (CTL) to join our New York office. CTLs drive the analytical and delivery engine of Bain cases across industries.

What you'll do:
- Independently manage workstreams on complex strategy cases
- Mentor and develop junior consultants
- Build lasting client relationships
- Lead business development support

Requirements:
- MBA from top program
- 3-5 years of post-MBA consulting or equivalent experience`,
    location: 'New York, NY',
    salary: '$170,000 - $205,000',
    date: daysAgo(15),
    status: 'Offer',
    source: 'Referral',
    resume_id: consultingResume.lastInsertRowid,
    cover_letter: 'Strong personalized letter via internal referral',
    recruiter: 'Tom Bradley',
    recruiter_email: 'tom.bradley@bain.com',
    follow_up: null,
    interview: daysAgo(3),
    notes: 'OFFER RECEIVED — $185k base + $30k bonus + $25k signing. Decision deadline in 10 days. Compare to McKinsey final round.',
    priority: 'high',
    comp_notes: 'Offer: $185k base, $30k performance bonus, $25k signing. Total: ~$240k year 1.',
    referral: 1,
    rejection: ''
  },
  {
    company: 'Visa',
    job_title: 'Director, Consulting Services — Financial Institutions',
    link: 'https://www.visa.com/careers',
    description: `Visa Consulting & Analytics (VCA) is seeking a Director to deliver data-driven consulting engagements for issuers and acquirers globally.

The Role:
- Lead consulting projects for Visa's FI clients (banks, credit unions)
- Develop customized analytics and recommendations
- Build relationships with senior client stakeholders
- Contribute to VCA thought leadership

Qualifications:
- 8+ years in financial services or consulting
- Payments industry knowledge preferred
- Strong data analytics skills`,
    location: 'New York, NY',
    salary: '$160,000 - $195,000',
    date: daysAgo(9),
    status: 'On Hold',
    source: 'LinkedIn',
    resume_id: fintechResume.lastInsertRowid,
    cover_letter: '',
    recruiter: 'Anna Roberts',
    recruiter_email: 'anna.roberts@visa.com',
    follow_up: daysAgo(-7),
    interview: null,
    notes: 'Recruiter said role is on hold pending budget approval. Check back in 3 weeks.',
    priority: 'low',
    comp_notes: '',
    referral: 0,
    rejection: ''
  },
  {
    company: 'Uber',
    job_title: 'Global Head of Risk Operations',
    link: 'https://www.uber.com/careers',
    description: `Uber is looking for a Global Head of Risk Operations to lead strategy and execution across our fraud prevention, compliance, and operational risk functions.

Scope of Role:
- Own global risk operations strategy across Rides, Eats, and Freight
- Build and lead a distributed team of risk managers
- Establish risk governance frameworks
- Partner with regulatory and legal teams

Requirements:
- 10+ years in risk management or operations
- Experience at global scale preferred
- Demonstrated people leadership`,
    location: 'San Francisco, CA',
    salary: '$195,000 - $240,000 + equity',
    date: daysAgo(1),
    status: 'Planning to Apply',
    source: 'Company Site',
    resume_id: fintechResume.lastInsertRowid,
    cover_letter: '',
    recruiter: '',
    recruiter_email: '',
    follow_up: null,
    interview: null,
    notes: 'Big stretch role but strong match. Apply this week.',
    priority: 'medium',
    comp_notes: 'Equity package could be $100k+/year',
    referral: 0,
    rejection: ''
  }
];

const insertedApps = apps.map(a => ({
  row: insertApp.run(
    a.company, a.job_title, a.link, a.description, a.location,
    a.salary, a.date, a.status, a.source, a.resume_id,
    a.cover_letter, a.recruiter, a.recruiter_email, a.follow_up,
    a.interview, a.notes, a.priority, a.comp_notes, a.referral, a.rejection
  ),
  data: a
}));

// Seed status history
const insertHistory = db.prepare(`
  INSERT INTO status_history (application_id, status, notes, created_at)
  VALUES (?, ?, ?, ?)
`);

insertedApps.forEach(({ row, data }) => {
  const appId = row.lastInsertRowid;
  const statusFlow = {
    'Interested': [['Interested', '', 21]],
    'Planning to Apply': [['Interested', '', 10], ['Planning to Apply', '', 5]],
    'Applied': [['Interested', '', 20], ['Applied', 'Submitted application', 14]],
    'Recruiter Screen': [['Interested', '', 25], ['Applied', '', 20], ['Recruiter Screen', 'Recruiter reached out', 15]],
    'Interview Round 1': [['Applied', '', 15], ['Recruiter Screen', '', 12], ['Interview Round 1', 'Scheduled interview', 3]],
    'Interview Round 2': [['Applied', '', 25], ['Recruiter Screen', '', 22], ['Interview Round 1', '', 18], ['Interview Round 2', 'Advanced to second round', 10]],
    'Final Round': [['Applied', '', 30], ['Recruiter Screen', '', 28], ['Interview Round 1', '', 25], ['Interview Round 2', '', 15], ['Final Round', 'Final round scheduled', 2]],
    'Offer': [['Applied', '', 40], ['Recruiter Screen', '', 35], ['Interview Round 1', '', 28], ['Interview Round 2', '', 18], ['Final Round', '', 8], ['Offer', 'OFFER RECEIVED', 3]],
    'Rejected': [['Applied', '', 10], ['Rejected', 'Application not selected', 6]],
    'On Hold': [['Applied', '', 15], ['Recruiter Screen', '', 10], ['On Hold', 'Role on hold pending budget', 5]],
  };

  const flow = statusFlow[data.status] || [['Interested', '', 5]];
  flow.forEach(([status, notes, daysBack]) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysBack);
    insertHistory.run(appId, status, notes, d.toISOString());
  });
});

// Seed follow-ups
const insertFollowUp = db.prepare(`
  INSERT INTO follow_ups (application_id, due_date, completed, notes)
  VALUES (?, ?, ?, ?)
`);

const appliedApps = insertedApps.filter(a =>
  ['Applied', 'Recruiter Screen', 'Interview Round 1', 'Interview Round 2', 'Final Round'].includes(a.data.status)
);

appliedApps.forEach(({ row }) => {
  const appId = row.lastInsertRowid;
  insertFollowUp.run(appId, daysAgo(-7), 0, 'Send follow-up email if no response');
});

// Seed sample emails
const insertEmail = db.prepare(`
  INSERT INTO email_activities (application_id, gmail_message_id, subject, sender, sender_email, body_preview, classification, received_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const bainApp = insertedApps.find(a => a.data.company === 'Bain & Company');
if (bainApp) {
  const appId = bainApp.row.lastInsertRowid;
  insertEmail.run(appId, 'msg_001', 'Offer Letter — Bain & Company Case Team Leader', 'Tom Bradley', 'tom.bradley@bain.com',
    'We are delighted to extend an offer for the Case Team Leader position at Bain & Company. Please find attached your formal offer letter with compensation details...',
    'offer', daysAgo(3));
}

const mckinApp = insertedApps.find(a => a.data.company === 'McKinsey & Company');
if (mckinApp) {
  const appId = mckinApp.row.lastInsertRowid;
  insertEmail.run(appId, 'msg_002', 'Interview Confirmation — McKinsey Round 2', 'Sarah Chen', 'sarah.chen@mckinsey.com',
    'Hi Andrew, I wanted to confirm your second round interview with Partner Michael Ross on Thursday at 2pm ET. Please prepare a 20-minute case presentation...',
    'interview_request', daysAgo(2));
  insertEmail.run(appId, 'msg_003', 'Application Received — McKinsey & Company', 'recruiting@mckinsey.com', 'recruiting@mckinsey.com',
    'Thank you for your interest in joining McKinsey. Your application has been received and is under review...',
    'confirmation', daysAgo(21));
}

const amazonApp = insertedApps.find(a => a.data.company === 'Amazon');
if (amazonApp) {
  const appId = amazonApp.row.lastInsertRowid;
  insertEmail.run(appId, 'msg_004', 'Update on Your Amazon Application', 'no-reply@amazon.jobs', 'no-reply@amazon.jobs',
    'Thank you for your interest in the Senior Product Manager role at Amazon Web Services. After careful consideration, we have decided to move forward with other candidates at this time...',
    'rejection', daysAgo(6));
}

console.log(`✅ Seeded ${apps.length} applications with status history, follow-ups, and email activity.`);
console.log(`✅ Seeded ${4} resumes.`);
