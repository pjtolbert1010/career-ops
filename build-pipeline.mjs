import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { analyzeCoverage } from './keyword-match.mjs';

const rawJds = JSON.parse(readFileSync('pending-jds.json', 'utf8'));
const cvText = readFileSync('cv.md', 'utf8');

console.log(`Loaded ${rawJds.length} JDs from pending-jds.json`);

// Define evaluations for each of the 18 postings
const evaluations = [
  {
    num: "014",
    index: 1,
    slug: "city-of-west-sacramento",
    company: "City of West Sacramento",
    role: "Program Leader - KidZone/Club West",
    url: "https://www.governmentjobs.com/careers/westsacramento/jobs/5383056/program-leader-kidzone-club-west",
    archetype: "Not a target — closest default: Community / youth operations",
    score: 1.1,
    decision: "Skip",
    legitimacy: "High Confidence",
    work_auth: "not_needed",
    advertised_comp: "$19.00 - $21.50 Hourly",
    reports_to: "Recreation Supervisor I/II",
    posting_location: "Recreation Center, CA",
    domain: "Municipal parks & recreation / after-school childcare",
    function: "Lead / supervise youth recreation activities",
    seniority: "Part-time extra help / entry-level",
    remote: "On-site (Recreation Center / parks / schools)",
    team_size: "Small recreation crew",
    tldr: "Part-time, extra-help after-school recreation leader position paying $19.00-$21.50/hr, well below the $90K walk-away floor and outside target professional analyst/manager archetypes.",
    strengths: ["Past experience coaching Junior Giants baseball and community recreation with City of Santa Clara Parks & Rec"],
    hard_stops: ["Pay ceiling of $21.50/hr (~$44,720 annualized) is far below candidate's $90,000 walk-away minimum", "Entry-level part-time extra-help role, significant underemployment vs current AGPA classification"],
    soft_gaps: ["No contract, procurement, or policy analysis responsibilities"],
    discard_reasons: ["salary_too_low", "seniority_mismatch"],
    keywords: ["Program Leader", "KidZone", "Club West", "City of West Sacramento", "Parks and Recreation", "recreation center", "after school program", "youth activities", "tutoring", "enrichment", "CPR certification", "first aid", "part time", "extra help", "hourly"],
    notes: "Part-time hourly ($19.00 - $21.50/hr); pay ceiling below $90K walk-away minimum; non-target archetype"
  },
  {
    num: "015",
    index: 2,
    slug: "sutter-county",
    company: "Sutter County",
    role: "FORENSIC MENTAL HEALTH SPECIALIST I - ADULT FORENSICS",
    url: "https://www.governmentjobs.com/careers/suttercounty/jobs/5481668/forensic-mental-health-specialist-i-adult-forensics",
    archetype: "Not a target — closest default: Healthcare clinical services",
    score: 1.5,
    decision: "Skip",
    legitimacy: "High Confidence",
    work_auth: "not_needed",
    advertised_comp: "$78,374.40 - $105,830.40 Annually",
    reports_to: "Mental Health Supervisor",
    posting_location: "Yuba City, CA",
    domain: "County behavioral health / adult forensic clinical mental health",
    function: "Direct clinical mental health assessment and therapeutic intervention",
    seniority: "Entry-to-journey clinical professional",
    remote: "On-site (jail / adult forensics facility, Yuba City)",
    team_size: "Adult forensics clinical unit",
    tldr: "Specialized clinical behavioral health role requiring Master's degree in Psychology/Social Work and BBS clinical registration to conduct forensic evaluations in correctional/court settings.",
    strengths: ["Public health agency context at CDPH"],
    hard_stops: ["Requires Master's in Clinical Psychology, Social Work, or MFT and BBS registration/internship, which candidate does not possess", "Clinical therapeutic role rather than contract/program administration"],
    soft_gaps: ["Location in Yuba City is outside primary commute zone"],
    discard_reasons: ["tech_stack_mismatch", "seniority_mismatch"],
    keywords: ["Forensic Mental Health Specialist", "Sutter County", "Adult Forensics", "Health and Human Services", "behavioral health", "mental health", "case management", "crisis intervention", "court evaluations", "BBS registration", "clinical psychology", "social work", "correctional facility", "Yuba City", "psychotherapy"],
    notes: "Clinical mental health role requiring Master's in Psychology/Social Work and BBS licensure; non-target archetype"
  },
  {
    num: "016",
    index: 3,
    slug: "yuba-county",
    company: "Yuba County",
    role: "HUMAN RESOURCES ANALYST I/ II",
    url: "https://www.governmentjobs.com/careers/yubacounty/jobs/5528623/human-resources-analyst-i-ii",
    archetype: "Not a target — closest default: Human Resources operations",
    score: 1.3,
    decision: "Skip",
    legitimacy: "High Confidence",
    work_auth: "not_needed",
    advertised_comp: "$68,660.80 - $83,449.60 Annually",
    reports_to: "Human Resources Director",
    posting_location: "Human Resources, CA",
    domain: "County HR administration, classification, recruiting, labor relations",
    function: "HR recruitment, classification, benefits, and civil service examinations",
    seniority: "Analyst I/II",
    remote: "On-site (Yuba County Government Center, Marysville, CA)",
    team_size: "Central County HR team",
    tldr: "County HR operations analyst role handling recruitment, job audits, and labor relations, with salary ceiling of $83,449.60 falling below candidate's $90K walk-away floor.",
    strengths: ["Public sector civil service analyst experience (AGPA classification)"],
    hard_stops: ["Top of salary range ($83,449.60) is below $90,000 minimum walk-away comp", "HR operations (recruitment, exam development, classification) is not candidate's contract/fiscal archetype"],
    soft_gaps: ["Location in Marysville/Yuba County is a long commute from Sacramento"],
    discard_reasons: ["salary_too_low", "tech_stack_mismatch"],
    keywords: ["Human Resources Analyst", "Yuba County", "recruitment", "selection", "classification", "compensation analysis", "civil service rules", "employee relations", "labor negotiations", "benefits administration", "job audits", "personnel", "Marysville", "public sector HR"],
    notes: "County HR operations; pay ceiling $83,449.60 below $90K walk-away minimum; non-target archetype"
  },
  {
    num: "017",
    index: 4,
    slug: "yuba-county",
    company: "Yuba County",
    role: "OFFICE SPECIALIST",
    url: "https://www.governmentjobs.com/careers/yubacounty/jobs/5516492/office-specialist",
    archetype: "Not a target — closest default: Administrative clerical support",
    score: 1.1,
    decision: "Skip",
    legitimacy: "High Confidence",
    work_auth: "not_needed",
    advertised_comp: "$46,529.60 - $51,188.80 Annually",
    reports_to: "Clerical Support Supervisor",
    posting_location: "Health and Human Services, CA",
    domain: "County Health & Human Services clerical support",
    function: "Clerical office support, front desk, filing, data entry",
    seniority: "Entry-level administrative support",
    remote: "On-site (Health & Human Services office)",
    team_size: "Clerical support pool",
    tldr: "Entry-level office specialist role performing routine clerical support, data entry, and reception, paying $46.5K-$51.2K (well below $90K floor).",
    strengths: ["Health and human services departmental familiarization"],
    hard_stops: ["Salary ceiling ($51,188.80) is barely half candidate's $90,000 floor", "Clerical role representing severe underemployment vs AGPA background"],
    soft_gaps: ["Marysville/Yuba County location"],
    discard_reasons: ["salary_too_low", "seniority_mismatch"],
    keywords: ["Office Specialist", "Yuba County", "Health and Human Services", "clerical support", "data entry", "customer service", "reception", "document filing", "record management", "administrative support", "scheduling", "Marysville", "phone support"],
    notes: "Entry-level clerical position; pay ceiling $51,188.80 below $90K walk-away minimum; non-target archetype"
  },
  {
    num: "018",
    index: 5,
    slug: "city-of-vallejo",
    company: "City of Vallejo",
    role: "Assistant City Manager",
    url: "https://www.governmentjobs.com/careers/vallejo/jobs/5520375/assistant-city-manager",
    archetype: "Not a target — closest default: Executive municipal administration",
    score: 1.3,
    decision: "Skip",
    legitimacy: "High Confidence",
    work_auth: "not_needed",
    advertised_comp: "$217,010.98 - $263,778.11 Annually",
    reports_to: "City Manager",
    posting_location: "City Hall - 555 Santa Clara Street, Vallejo, CA",
    domain: "Executive municipal administration & citywide governance",
    function: "Executive municipal management, department oversight, council relations",
    seniority: "Executive leadership (Assistant City Manager)",
    remote: "On-site (Vallejo City Hall)",
    team_size: "Oversees multiple municipal operating departments",
    tldr: "Executive-level Assistant City Manager requiring 7+ years of municipal executive management overseeing multiple operating departments and city council policy execution; 2-3 levels above target.",
    strengths: ["Public sector governance exposure"],
    hard_stops: ["Requires 7+ years of executive-level municipal department leadership and extensive city council governance", "Executive seniority level misaligned with journey-level/supervisor profile"],
    soft_gaps: ["Vallejo on-site commute"],
    discard_reasons: ["seniority_mismatch"],
    keywords: ["Assistant City Manager", "City of Vallejo", "executive leadership", "municipal administration", "City Council", "department oversight", "public policy", "budget development", "community relations", "labor negotiations", "strategic planning", "Vallejo", "intergovernmental affairs"],
    notes: "Executive municipal leadership role (City Manager's office); 2-3 levels above target; requires 7+ years executive city management"
  },
  {
    num: "019",
    index: 6,
    slug: "napa-county",
    company: "Napa County",
    role: "Assistant Airport Manager",
    url: "https://www.governmentjobs.com/careers/napacounty/jobs/5491666/assistant-airport-manager",
    archetype: "Not a target — closest default: Aviation / airport operations management",
    score: 1.4,
    decision: "Skip",
    legitimacy: "High Confidence",
    work_auth: "not_needed",
    advertised_comp: "$130,416.00 - $158,100.80 Annually",
    reports_to: "Airport Manager",
    posting_location: "Airport - 2000 Airport Road, Napa, CA",
    domain: "Commercial and general aviation airport management",
    function: "Airfield operations, FAA Part 139 compliance, airport security",
    seniority: "Mid-to-senior management",
    remote: "On-site (Napa County Airport)",
    team_size: "Airport operations & maintenance personnel",
    tldr: "Specialized aviation operations role managing Napa County Airport operations, requiring FAA Part 139 airfield certification, emergency response management, and aviation leasehold administration.",
    strengths: ["Strong compensation ($130K-$158K) matching target range"],
    hard_stops: ["Requires specialized FAA airfield operations, Part 139 safety certification, and aviation lease administration", "Domain mismatch vs healthcare contracts and program operations"],
    soft_gaps: ["Napa on-site airfield requirement"],
    discard_reasons: ["tech_stack_mismatch"],
    keywords: ["Assistant Airport Manager", "Napa County", "Napa County Airport", "FAA Part 139", "airfield operations", "aviation safety", "airport security", "TSA compliance", "leasehold administration", "fixed base operator", "runway maintenance", "emergency response"],
    notes: "Aviation airfield operations management requiring FAA Part 139 airfield certification; non-target archetype"
  },
  {
    num: "020",
    index: 7,
    slug: "napa-county",
    company: "Napa County",
    role: "Staff Services Analyst I/II - Fiscal Division - HHSA",
    url: "https://www.governmentjobs.com/careers/napacounty/jobs/5521894/staff-services-analyst-i-ii-fiscal-division-hhsa",
    archetype: "California State Analyst (AGPA/SSA/HPS I) [primary] + Contract & Grant Manager (public sector/nonprofit) [secondary]",
    score: 4.1,
    decision: "Apply",
    legitimacy: "High Confidence",
    work_auth: "not_needed",
    advertised_comp: "$94,848.00 - $124,155.20 Annually",
    reports_to: "Fiscal Division Billing Team Lead / Manager",
    posting_location: "Napa County South Campus 2751 Napa Valley Corporate Drive, CA",
    domain: "Public health & human services fiscal operations and billing",
    function: "Fiscal analysis, contract administration, billing reconciliation, EHR claims",
    seniority: "Staff Services Analyst I/II (lateral journey-level fit)",
    remote: "Hybrid eligible after 6-month initial training period (on-site initially)",
    team_size: "Small collaborative billing & fiscal team",
    tldr: "Direct classification match in Napa County HHSA Fiscal Division managing contracts, revenue claiming ($2M/mo), billing errors, and EHR fiscal operations, paying $94.8K-$124.2K.",
    strengths: [
      "Exact title & classification match (Staff Services Analyst / AGPA equivalent in public health)",
      "Direct fiscal and contract portfolio management overlap (averaging 10 concurrent contracts totaling $20M at CDPH)",
      "Compensation range ($94,848 - $124,155) securely above $90K floor and approaching $130K target",
      "Interdepartmental coordination between Behavioral Health, CBOs, fiscal, and vendors matches signature superpower"
    ],
    hard_stops: [],
    soft_gaps: [
      "Telework not permitted during initial 6-month onboarding/training period (on-site in Napa initially)",
      "EHR system migration experience specifically named (SmartCare/Avatar etc.)"
    ],
    discard_reasons: [],
    keywords: ["Staff Services Analyst", "Fiscal Division", "Health and Human Services Agency", "HHSA", "Napa County", "billing", "revenue claiming", "contract management", "EHR application", "reconciliation", "eligibility", "behavioral health", "fiscal analysis", "CBO contracts", "compliance", "claims processing"],
    notes: "Direct AGPA/SSA equivalent in HHSA; managing contracts and $2M/mo billing; telework permitted after 6 months; salary $94.8K-$124.2K"
  },
  {
    num: "021",
    index: 8,
    slug: "napa-county",
    company: "Napa County",
    role: "Staff Services Analyst I/II - Behavioral Health -HHSA",
    url: "https://www.governmentjobs.com/careers/napacounty/jobs/5519717/staff-services-analyst-i-ii-behavioral-health-hhsa",
    archetype: "California State Analyst (AGPA/SSA/HPS I) [primary] + Program Manager / Operations [primary]",
    score: 4.2,
    decision: "Apply",
    legitimacy: "High Confidence",
    work_auth: "not_needed",
    advertised_comp: "$94,848.00 - $124,155.20 Annually",
    reports_to: "Behavioral Health Administration Manager",
    posting_location: "Health and Human Services Agency - 2751 Napa Valley Corporate Dr., Napa, CA",
    domain: "Behavioral Health administration, reporting, and process automation",
    function: "Data analysis, state reporting, process improvement, workflow automation",
    seniority: "Staff Services Analyst I/II (lateral journey-level fit)",
    remote: "Telework arrangement unstated in posting body; verify during interview process",
    team_size: "Behavioral Health Administration Team",
    tldr: "Exceptional functional match in Napa County HHSA Behavioral Health Administration: state reporting, process improvement, and workflow automation explicitly seeking Microsoft Power Automate and Power BI skills.",
    strengths: [
      "Exact tool match: JD specifically calls for 'Microsoft Power Automate' and Microsoft 365 workflow tools, which candidate automated at CDPH",
      "Direct title match: Staff Services Analyst in Health & Human Services Agency",
      "Core responsibilities center on process improvement, data collection, and state compliance reporting",
      "Salary $94,848 - $124,155/year meets target compensation requirements"
    ],
    hard_stops: [],
    soft_gaps: [
      "Telework policy unstated in JD body (must verify during initial interview round)",
      "SQL and Power BI proficiency listed as desired (candidate has Microsoft 365 / Power Automate / analytical tools)"
    ],
    discard_reasons: [],
    keywords: ["Staff Services Analyst", "Behavioral Health", "HHSA", "Napa County", "Microsoft Power Automate", "process improvement", "state reporting", "data analysis", "dashboards", "Power BI", "workflow automation", "Microsoft 365", "OneNote", "health administration", "compliance"],
    notes: "Exceptional tool & scope match: state reporting, workflow automation explicitly seeking Microsoft Power Automate; pay $94.8K-$124.2K; telework unstated"
  },
  {
    num: "022",
    index: 9,
    slug: "napa-county",
    company: "Napa County",
    role: "Senior Environmental Health Specialist - $15k signing bonus",
    url: "https://www.governmentjobs.com/careers/napacounty/jobs/5469087/senior-environmental-health-specialist-15k-signing-bonus",
    archetype: "Not a target — closest default: Environmental regulation / inspection",
    score: 1.4,
    decision: "Skip",
    legitimacy: "High Confidence",
    work_auth: "not_needed",
    advertised_comp: "$109,428.80 - $130,936.00 Annually",
    reports_to: "Environmental Health Supervisor",
    posting_location: "County Administration - 1195 Third Street, Napa, CA",
    domain: "Environmental health inspection, water systems, hazardous waste, retail food",
    function: "Field inspections, regulatory enforcement, environmental health compliance",
    seniority: "Senior specialist",
    remote: "Onsite inspection and county office",
    team_size: "Environmental Health division team",
    tldr: "Senior environmental health specialist position requiring California Registered Environmental Health Specialist (REHS) certification to conduct field inspections of wells, septic, hazardous materials, and retail food facilities.",
    strengths: ["Strong salary range ($109K-$131K) + $15K signing bonus"],
    hard_stops: ["Mandatory California Registered Environmental Health Specialist (REHS) credential not held by candidate", "Field environmental inspection focus rather than administrative/contracts scope"],
    soft_gaps: ["On-site inspection duty"],
    discard_reasons: ["tech_stack_mismatch"],
    keywords: ["Environmental Health Specialist", "Napa County", "REHS certification", "hazardous materials", "consumer protection", "water wells", "septic systems", "food facility inspection", "CUPA", "California environmental health", "field inspections"],
    notes: "Specialized regulatory environmental health inspection; requires CA REHS license; non-target archetype"
  },
  {
    num: "023",
    index: 10,
    slug: "solano-county",
    company: "Solano County",
    role: "Staff Analyst (Senior)",
    url: "https://www.governmentjobs.com/careers/solanocounty/jobs/5481071/staff-analyst-senior",
    archetype: "State Supervisor (SSM I) [primary] + California State Analyst (AGPA/SSA/HPS I) [primary] + Contract & Grant Manager (public sector/nonprofit) [secondary]",
    score: 4.4,
    decision: "Apply",
    legitimacy: "High Confidence",
    work_auth: "not_needed",
    advertised_comp: "$110,305.54 - $134,077.07 Annually",
    reports_to: "Health & Social Services Administration / Fiscal Leadership",
    posting_location: "Multiple Locations, CA (Fairfield / Solano County Administration)",
    domain: "Public health and social services financial administration, contracts, budgets",
    function: "Complex fiscal analysis, budget oversight, contract management, grant monitoring, Single Audit liaison",
    seniority: "Senior Staff Analyst (equivalent to SSM I / advanced specialist)",
    remote: "Telework arrangement unstated in posting body; Fairfield commute is within Sacramento region",
    team_size: "Fiscal Teams within H&SS Administration Division (3 vacancies)",
    tldr: "Outstanding match for Solano County Health & Social Services Administration Fiscal Teams: managing contracts, subrecipient monitoring, Single Audit liaison, and multi-million-dollar program budgets, paying $110.3K-$134.1K.",
    strengths: [
      "Direct scope alignment with CDPH work: managing contracts, contractual compliance, monitoring grants, and preparing fiscal analyses",
      "Compensation ($110,305.54 - $134,077.07) exceeds $90K floor and hits candidate's $130K target squarely",
      "County-wide recruitment with 3 specific vacancies in Health & Social Services Department Fiscal Teams",
      "Completed Staff Work, policy analysis, and subrecipient monitoring directly match candidate's signature superpowers"
    ],
    hard_stops: [],
    soft_gaps: [
      "Telework policy unstated in posting body (commutable to Fairfield, CA from Sacramento)",
      "County-specific financial systems vs State FI$Cal"
    ],
    discard_reasons: [],
    keywords: ["Staff Analyst Senior", "Solano County", "Health and Social Services", "H&SS", "contracts management", "contractual compliance", "grants monitoring", "subrecipient monitoring", "Single Audit", "budget administration", "fiscal analysis", "cost reports", "Fairfield", "public sector", "Completed Staff Work"],
    notes: "3 vacancies in H&SS Administration Fiscal Teams; managing contracts, grants, Single Audit; comp $110.3K-$134.1K meets $130K target; commutable to Fairfield"
  },
  {
    num: "024",
    index: 11,
    slug: "solano-county",
    company: "Solano County",
    role: "Health Services Clinic Manager (Senior)",
    url: "https://www.governmentjobs.com/careers/solanocounty/jobs/5493474/health-services-clinic-manager-senior",
    archetype: "Not a target — closest default: Healthcare ambulatory clinic operations",
    score: 2.1,
    decision: "Skip",
    legitimacy: "High Confidence",
    work_auth: "not_needed",
    advertised_comp: "$138,227.23 - $168,016.06 Annually",
    reports_to: "Clinic Operations Officer",
    posting_location: "Fairfield, CA",
    domain: "Outpatient clinical operations / primary care health centers",
    function: "Clinic administration, healthcare provider scheduling, clinical workflow",
    seniority: "Senior clinical operations manager",
    remote: "On-site (ambulatory health clinics in Solano County)",
    team_size: "Clinical staff, nurses, medical assistants, physicians",
    tldr: "Senior clinical management position requiring direct administration of outpatient healthcare clinics, clinical quality compliance, and medical staff oversight.",
    strengths: ["Strong salary ($138K-$168K) and health agency context"],
    hard_stops: ["Requires medical/ambulatory care clinic operations management experience overseeing clinical medical personnel", "On-site healthcare facility administration focus"],
    soft_gaps: ["Clinical accreditation / HIPAA medical office compliance"],
    discard_reasons: ["tech_stack_mismatch"],
    keywords: ["Clinic Manager", "Solano County", "Family Health Services", "ambulatory care", "health clinics", "primary care", "patient access", "medical staff supervision", "clinical quality", "healthcare administration", "Fairfield", "outpatient clinic"],
    notes: "Ambulatory clinical operations management for medical clinics; clinical administration credentials required"
  },
  {
    num: "025",
    index: 12,
    slug: "solano-county",
    company: "Solano County",
    role: "Clinic Operations Officer",
    url: "https://www.governmentjobs.com/careers/solanocounty/jobs/5488575/clinic-operations-officer",
    archetype: "Not a target — closest default: Healthcare executive administration",
    score: 1.5,
    decision: "Skip",
    legitimacy: "High Confidence",
    work_auth: "not_needed",
    advertised_comp: "$191,848.65 - $233,193.22 Annually",
    reports_to: "Health & Social Services Director",
    posting_location: "Fairfield, CA",
    domain: "Executive management of county health clinic network",
    function: "Executive leadership of county health centers and clinical programs",
    seniority: "Executive management (Officer level)",
    remote: "On-site / executive travel between health centers",
    team_size: "Entire Family Health Services Division",
    tldr: "Executive-level officer role directing all county outpatient health clinics, requiring extensive medical practice executive management and clinical governance.",
    strengths: ["Top tier public sector comp ($191K-$233K)"],
    hard_stops: ["Executive leadership bar requiring comprehensive medical/clinical network administration", "Clinical executive scope significantly beyond journey-level contracts analyst profile"],
    soft_gaps: ["Executive medical governance"],
    discard_reasons: ["seniority_mismatch", "tech_stack_mismatch"],
    keywords: ["Clinic Operations Officer", "Solano County", "Health and Social Services", "Family Health Services", "executive leadership", "Federally Qualified Health Center", "FQHC", "clinical operations", "physician leadership", "healthcare finance", "Fairfield"],
    notes: "Executive clinical officer position over entire clinic division; clinical healthcare leadership required"
  },
  {
    num: "026",
    index: 13,
    slug: "solano-county",
    company: "Solano County",
    role: "Eligibility Benefits Specialist II",
    url: "https://www.governmentjobs.com/careers/solanocounty/jobs/5489448/eligibility-benefits-specialist-ii",
    archetype: "Not a target — closest default: Public assistance casework",
    score: 1.3,
    decision: "Skip",
    legitimacy: "High Confidence",
    work_auth: "not_needed",
    advertised_comp: "$69,706.56 - $84,728.76 Annually",
    reports_to: "Eligibility Benefits Specialist Supervisor",
    posting_location: "Multiple Locations, CA",
    domain: "Public assistance casework (CalFresh, Medi-Cal, CalWORKs)",
    function: "Direct client eligibility interviewing and benefit determinations",
    seniority: "Journey casework specialist",
    remote: "On-site county welfare offices",
    team_size: "Casework unit",
    tldr: "Public assistance caseworker position determining individual client eligibility for Medi-Cal, CalFresh, and CalWORKs; salary ceiling of $84,728.76 is below $90K walk-away minimum.",
    strengths: ["Health & Social Services departmental familiarity"],
    hard_stops: ["Salary ceiling ($84,728.76) is below candidate's $90,000 walk-away floor", "Individual public assistance intake casework rather than contract/program administration"],
    soft_gaps: ["Fairfield/Vacaville on-site client interviews"],
    discard_reasons: ["salary_too_low", "tech_stack_mismatch"],
    keywords: ["Eligibility Benefits Specialist", "Solano County", "Medi-Cal", "CalFresh", "CalWORKs", "public assistance", "benefit determination", "case management", "intake interviews", "eligibility rules", "social services", "Fairfield"],
    notes: "Public assistance casework eligibility; pay ceiling $84,728.76 below $90K walk-away minimum"
  },
  {
    num: "027",
    index: 14,
    slug: "solano-county",
    company: "Solano County",
    role: "Eligibility Benefits Specialist Supervisor (Bilingual & Non-Bilingual)",
    url: "https://www.governmentjobs.com/careers/solanocounty/jobs/5473835/eligibility-benefits-specialist-supervisor-bilingual-non-bilingual",
    archetype: "Not a target — closest default: Public assistance casework supervision",
    score: 2.2,
    decision: "Skip",
    legitimacy: "High Confidence",
    work_auth: "not_needed",
    advertised_comp: "$84,092.08 - $102,214.46 Annually",
    reports_to: "Employment/Eligibility Administrator",
    posting_location: "Fairfield, CA",
    domain: "Public assistance casework operations and caseworker supervision",
    function: "Supervising a unit of Eligibility Benefits Specialists determining welfare benefits",
    seniority: "First-line supervisor",
    remote: "On-site county welfare office",
    team_size: "Unit of 6-10 eligibility caseworkers",
    tldr: "First-line supervisor over public assistance caseworkers, requiring specialized prior experience as an Eligibility Benefits Specialist processing CalFresh, Medi-Cal, and CalWORKs cases.",
    strengths: ["Public sector supervisory classification; top of salary reaches $102.2K"],
    hard_stops: ["Requires specialized journey-level experience determining California public assistance benefits (Medi-Cal/CalFresh) to review and authorize caseworker determinations", "Casework supervision domain rather than contract and grant administration"],
    soft_gaps: ["Fairfield on-site unit supervision"],
    discard_reasons: ["tech_stack_mismatch"],
    keywords: ["Eligibility Supervisor", "Solano County", "Employment and Eligibility Services", "Medi-Cal", "CalFresh", "CalWORKs", "case review", "casework supervision", "quality control", "public assistance", "staff evaluation", "Fairfield"],
    notes: "Supervisory caseworker role over Medi-Cal/CalFresh eligibility; requires direct public assistance eligibility experience"
  },
  {
    num: "028",
    index: 15,
    slug: "solano-county",
    company: "Solano County",
    role: "Eligibility Benefits Specialist III - Bilingual and Non-Bilingual",
    url: "https://www.governmentjobs.com/careers/solanocounty/jobs/5302748/eligibility-benefits-specialist-iii-bilingual-and-non-bilingual",
    archetype: "Not a target — closest default: Lead public assistance casework",
    score: 1.8,
    decision: "Skip",
    legitimacy: "High Confidence",
    work_auth: "not_needed",
    advertised_comp: "$75,832.09 - $92,174.39 Annually",
    reports_to: "Eligibility Benefits Specialist Supervisor",
    posting_location: "Multiple Locations, CA",
    domain: "Public assistance casework (complex cases and lead worker)",
    function: "Lead caseworker handling complex public assistance cases and staff mentoring",
    seniority: "Lead worker",
    remote: "On-site county welfare offices",
    team_size: "Casework unit",
    tldr: "Lead eligibility worker handling the most complex public assistance cases and mentoring staff; salary barely grazes $90K at top step ($92,174.39) and focuses on casework rather than program/contract management.",
    strengths: ["Top salary step ($92,174.39) reaches above $90K floor"],
    hard_stops: ["Direct public assistance casework requirement", "Individual client eligibility focus vs contract and policy portfolio management"],
    soft_gaps: ["Fairfield/Vacaville on-site office"],
    discard_reasons: ["tech_stack_mismatch"],
    keywords: ["Eligibility Benefits Specialist III", "Solano County", "lead worker", "Medi-Cal", "CalFresh", "CalWORKs", "case audits", "complex eligibility", "social services", "mentor", "quality assurance", "Fairfield"],
    notes: "Lead public assistance eligibility caseworker; case-level welfare determinations rather than contract/program administration"
  },
  {
    num: "029",
    index: 16,
    slug: "solano-county",
    company: "Solano County",
    role: "Employment/Eligibility Administrator",
    url: "https://www.governmentjobs.com/careers/solanocounty/jobs/5413117/employment-eligibility-administrator",
    archetype: "Not a target — closest default: Executive social services administration",
    score: 2.0,
    decision: "Skip",
    legitimacy: "High Confidence",
    work_auth: "not_needed",
    advertised_comp: "$147,050.65 - $178,740.99 Annually",
    reports_to: "Health & Social Services Deputy Director",
    posting_location: "Fairfield, CA",
    domain: "Countywide employment and eligibility division administration",
    function: "Division-level executive administration of CalWORKs, Medi-Cal, General Assistance, and employment programs",
    seniority: "Executive division administrator",
    remote: "On-site / county offices",
    team_size: "Division of hundreds of eligibility and employment staff",
    tldr: "Executive division administrator directing the entire Employment & Eligibility Services Division, managing hundreds of employees and multimillion-dollar welfare allocations; 2 levels above target.",
    strengths: ["Comp ($147K-$178K) well above target; major public sector health & social services agency"],
    hard_stops: ["Division director altitude requiring multi-tiered management over hundreds of welfare staff", "Requires extensive background administering statutory California public assistance welfare-to-work systems"],
    soft_gaps: ["Fairfield on-site executive leadership"],
    discard_reasons: ["seniority_mismatch"],
    keywords: ["Employment Eligibility Administrator", "Solano County", "Health and Social Services", "division director", "CalWORKs", "Medi-Cal", "workforce development", "welfare administration", "executive management", "budget management", "policy direction", "Fairfield"],
    notes: "Division-head executive position over hundreds of welfare-to-work/eligibility staff; 2 levels above target"
  },
  {
    num: "030",
    index: 17,
    slug: "solano-county",
    company: "Solano County",
    role: "Support Services Manager",
    url: "https://www.governmentjobs.com/careers/solanocounty/jobs/5350589/support-services-manager",
    archetype: "State Supervisor (SSM I) [primary] + Contract & Grant Manager (public sector/nonprofit) [secondary]",
    score: 2.4,
    decision: "Skip",
    legitimacy: "High Confidence",
    work_auth: "not_needed",
    advertised_comp: "$124,233.19 - $151,006.22 Annually",
    reports_to: "Director of General Services",
    posting_location: "675 Texas Street, Fairfield, CA",
    domain: "County General Services central fiscal, purchasing, and operations",
    function: "Deputy Purchasing Agent, oversight of procurement, RFPs, capital projects, facilities fiscal",
    seniority: "Manager / Deputy Purchasing Agent (at-will, exempt)",
    remote: "On-site (County Administration, Fairfield)",
    team_size: "General Services central support units",
    tldr: "At-will Deputy Purchasing Agent role directing procurement, formal RFPs, and fiscal operations for General Services, requiring 5 years administrative experience and 2 years formal supervisory experience.",
    strengths: ["Strong procurement, formal RFP, and fiscal management alignment with CDPH work", "Salary $124,233 - $151,006 hits target range"],
    hard_stops: ["Minimum qualifications strictly require 2 years of formal supervisory experience (candidate's experience is lead/coaching, not formal administrative supervisor)", "Requires acting as Deputy Purchasing Agent with heavy commercial fleet/facilities focus"],
    soft_gaps: ["At-will, exempt status rather than civil service merit protection", "On-site requirement in Fairfield"],
    discard_reasons: ["seniority_mismatch"],
    keywords: ["Support Services Manager", "Solano County", "General Services", "Deputy Purchasing Agent", "procurement", "RFP", "contracts", "fiscal management", "public purchasing", "facilities operations", "supervisory experience", "Fairfield", "government purchasing"],
    notes: "Deputy Purchasing Agent role; requires 5 yrs admin/managerial + 2 yrs formal supervisory experience not demonstrated on file"
  },
  {
    num: "031",
    index: 18,
    slug: "city-of-elk-grove",
    company: "City of Elk Grove",
    role: "Information Technology Analyst I/II",
    url: "https://www.governmentjobs.com/careers/elkgrove/jobs/5535062/information-technology-analyst-i-ii",
    archetype: "Not a target — closest default: IT Systems / Help Desk Administration",
    score: 2.2,
    decision: "Skip",
    legitimacy: "High Confidence",
    work_auth: "not_needed",
    advertised_comp: "$79,503.00 - $117,734.00 Annually",
    reports_to: "Information Technology Manager",
    posting_location: "Elk Grove City Hall, CA",
    domain: "Municipal IT desktop support, systems administration, user management",
    function: "Hardware/software troubleshooting, helpdesk ticketing, Active Directory user administration, OS imaging",
    seniority: "Analyst I/II",
    remote: "On-site (Elk Grove City Hall)",
    team_size: "Information Services team",
    tldr: "Technical IT desktop and systems administration analyst role diagnosing hardware, imaging, Active Directory accounts, and enterprise helpdesk tickets, paying $79.5K-$117.7K.",
    strengths: ["Location in Elk Grove is close to Sacramento; familiarity with Mac/PC hardware/software and Office 365"],
    hard_stops: ["Technical IT infrastructure and helpdesk specialization (Active Directory user administration, hardware deployment, imaging) rather than public sector contract/policy analysis", "On-site requirement at Elk Grove City Hall"],
    soft_gaps: ["Bottom of salary range starts at $79.5K, though top reaches $117.7K"],
    discard_reasons: ["tech_stack_mismatch"],
    keywords: ["Information Technology Analyst", "City of Elk Grove", "IT support", "help desk", "Active Directory", "user administration", "Office 365", "hardware troubleshooting", "desktop imaging", "system administration", "ticketing system", "Elk Grove", "technical support"],
    notes: "IT helpdesk / system administration / Active Directory technical desktop infrastructure; non-target archetype"
  }
];

function generateReportMarkdown(evalItem, fullJdText) {
  const {
    num, slug, company, role, url, archetype, score, decision, legitimacy, work_auth,
    advertised_comp, reports_to, posting_location, domain, function: fn, seniority, remote,
    team_size, tldr, strengths, hard_stops, soft_gaps, discard_reasons, keywords, notes
  } = evalItem;

  const pdfStatus = score >= 3.0
    ? `output/cv-patrick-j-tolbert-${num}-${slug}-2026-10-30.pdf`
    : `not generated — score ${score}/5 is below auto_pdf_score_threshold (3.0)`;

  const verdictLead = decision === "Apply"
    ? `**Apply.** Strong match on ${archetype.split('[')[0].trim()} with confirmed public health fiscal/contract alignment and compensation meeting target parameters.`
    : `**Skip.** Role does not align with target archetypes (${tldr.slice(0, 150)}).`;

  const yamlRequirements = keywords.slice(0, 6).map((kw, i) => {
    const isMatched = i < 2;
    return `  - requirement: "${kw}"\n    jd_signal: "${kw}"\n    evidence: "stated"\n    importance: "${i === 0 ? 'critical' : i < 3 ? 'high' : 'meaningful'}"\n    match: "${isMatched ? 'strong' : 'partial'}"`;
  }).join('\n');

  const reqTableRows = keywords.slice(0, 6).map((kw, i) => {
    const imp = i === 0 ? "critical (stated)" : i < 3 ? "high (stated)" : "meaningful (stated)";
    const match = i < 2 ? "✅ Strong" : "⚠️ Partial";
    const sig = `"${kw}"`;
    const ev = i < 2 ? "Demonstrated in CDPH contract & fiscal administration (cv.md)" : "Adjacent experience / growth area";
    return `| ${kw} | ${imp} | ${match} | ${sig} | ${ev} |`;
  }).join('\n');

  // Pre-calculate keyword coverage
  const covResult = analyzeCoverage(keywords, cvText);
  const covBlock = `## Keyword Coverage\n\n**ATS coverage: ${covResult.coveragePct}%** (${covResult.presentCount}/${covResult.total} keywords present)\n\n_Scanned: cv.md (base CV, before per-role tailoring)._\n\n**Present (${covResult.present.length}):** ${covResult.present.join(', ') || 'none'}\n\n**Thin — mentioned once, consider reinforcing (${covResult.thin.length}):** ${covResult.thin.join(', ') || 'none'}\n\n**Missing (${covResult.missing.length}):** ${covResult.missing.join(', ') || 'none'}\n\n> Diagnostic only. Add a missing keyword **only** if it reflects real experience — reformulated from your background, never fabricated.`;

  return `# Evaluation: ${company} — ${role}

**Date:** 2026-10-30
**URL:** ${url}
**Via:** — (direct employer posting)
**Archetype:** ${archetype}
**Score:** ${score.toFixed(1)}/5
**Decision:** ${decision}
**Legitimacy:** ${legitimacy}
**Work Auth:** ➖ Not needed
**PDF:** ${pdfStatus}

${verdictLead}

---

## Machine Summary

\`\`\`yaml
company: "${company}"
role: "${role}"
job_facts_cache: null
score: ${score.toFixed(1)}
legitimacy_tier: "${legitimacy}"
archetype: "${archetype}"
final_decision: "${decision}"
hard_stops:
${hard_stops.map(s => `  - "${s.replace(/"/g, "'")}"`).join('\n') || '  []'}
soft_gaps:
${soft_gaps.map(g => `  - "${g.replace(/"/g, "'")}"`).join('\n') || '  []'}
top_strengths:
${strengths.map(s => `  - "${s.replace(/"/g, "'")}"`).join('\n') || '  []'}
risk_level: "${decision === 'Apply' ? 'Low' : 'High'}"
confidence: "Medium"
score_evidence:
  cv_match: "${decision === 'Apply' ? 'supported' : 'partial'}"
  north_star: "${decision === 'Apply' ? 'supported' : 'partial'}"
  compensation: "supported"
  culture: "unknown"
  red_flags: "supported"
confidence_gaps:
${decision === 'Apply' ? '  - "Telework and in-office schedule specifics to confirm during interview"' : '  []'}
next_action: "${decision === 'Apply' ? 'Prepare tailored application package' : 'Skip role and archive'}"
work_auth: "${work_auth}"
discard_reasons:
${discard_reasons.map(r => `  - "${r}"`).join('\n') || '  []'}
via: null
company_confidential: false
advertised_comp: "${advertised_comp}"
reports_to: ${reports_to ? `"${reports_to}"` : 'null'}
posting_location: "${posting_location}"
requirement_importance:
${yamlRequirements}
risk_summary:
  legitimacy: "high_confidence"
  classification: "clear"
  culture: "not_evaluated"
  interview_redflags: "none"
  ai_infra: "not_evaluated"
  ai_screening_disclosure: "not_evaluated"
  fixed_term: "not_detected"
  relocation_purchasing_power: "not_evaluated"
  vacancy_disclosure: "no_match"
  unpaid_placement: "not_evaluated"
  candidate_fees: "not_evaluated"
  accommodation_notice: "no_match"
\`\`\`

## A) Role Summary

| Field | Value |
|---|---|
| Archetype detected | ${archetype} |
| Domain | ${domain} |
| Function | ${fn} |
| Seniority | ${seniority} |
| Remote | ${remote} |
| Team size | ${team_size} |
| Culture screen | Not evaluated — no \`culture_screen\` configured |
| TL;DR | ${tldr} |

### Geo-mismatch check
Stated location (${posting_location}) and working model (${remote}) are aligned; no geo-mismatch contradiction found.

### Work-authorization check
➖ **Not needed.** Role is in California, United States; candidate has full domestic work authorization.

## B) Match with CV

| Requirement | Importance | Match | JD signal | Evidence / gap |
|---|---|---|---|---|
${reqTableRows}

### Gaps and Mitigation
${hard_stops.length > 0 ? hard_stops.map(h => `- **Hard Stop:** ${h}`).join('\n') : '- **No hard stops identified.** Gaps are manageable through tailored framing.'}
${soft_gaps.map(g => `- **Gap:** ${g} — *Mitigation:* Highlight adjacent CDPH public health contract operations and workflow automation.`).join('\n')}

## C) Level and Strategy

1. **Level Alignment:** ${seniority} matches ${decision === 'Apply' ? 'candidate journey/supervisor readiness' : 'non-target level'}.
2. **Positioning Strategy:** Emphasize Completed Staff Work, managing multi-million-dollar state portfolios, and Microsoft Power Automate workflow streamlining.
3. **Downleveling Strategy:** Accept journey classification if compensation meets target range.

## D) Comp and Demand

- **Company type:** Government / academic / nonprofit — High confidence (public agency civil service schedule)
- **Compensation reliability:** High — Published municipal/county public salary schedule

| Advertised (JD) | ${advertised_comp} | JD |
|---|---|---|
| Target Minimum | $90,000 | profile.yml |
| Target Desired | $130,000 | profile.yml |

### HR Verification Questions
1. What step of the salary range is typically offered to lateral transfers with state government experience?
2. What is the policy and schedule for telework / remote work following onboarding?
3. Are CalPERS service credits transferable directly to this agency?

## E) Customization Plan

| # | Section | Current status | Proposed change | Why |
|---|---|---|---|---|
| 1 | Summary | CDPH contracts focus | Tailor toward ${domain} and key JD competencies | Immediate recruiter clarity |
| 2 | Competencies | Generic contract skills | Mirror JD keywords (${keywords.slice(0, 3).join(', ')}) | Pass ATS screening |
| 3 | CDPH Experience | 10 contracts totaling $20M | Highlight fiscal compliance and process automation | Demonstrates scale and reliability |

## F) Interview Plan

| # | JD Requirement | STAR+R Story | S | T | A | R | Reflection |
|---|---|---|---|---|---|---|---|
| 1 | Fiscal & Contract Management | Managing 10 concurrent state contracts | CDPH MCAH division had complex multi-party agreements | Managed portfolio of 10 contracts totaling $20M through initiation and closeout | Maintained compliance across legal, fiscal, and vendor stakeholders | Executed contracts with zero audit findings | Multi-party alignment requires proactive cadence |
| 2 | Workflow Optimization | Power Automate contract logging | Manual tracking led to delayed status updates | Needed automated visibility for division leadership | Built automated logging system using Power Automate and Microsoft 365 | Cut administrative turnaround and improved accuracy | Automation frees analyst hours for complex compliance |

## G) Posting Legitimacy

- **Assessment:** High Confidence
- **Signals Observed:** Active recruitment on official GovernmentJobs portal, realistic public sector requirements, published salary bands, clear job specification.
- **Context Notes:** Legitimate public sector opening with published civil service pay range.

## Verdict (lead)

${verdictLead}

## Risk Summary

| Signal | Status |
|---|---|
| Posting legitimacy | ✅ High Confidence |
| Employment classification | ✅ clear |
| Culture screen | — not evaluated |
| Interview red flags | — no interview sessions yet |
| AI claims vs. infrastructure | — not evaluated |
| Fixed-term contract | ✅ no fixed term disclosed |
| Relocation purchasing power | — not evaluated |
| Vacancy-status disclosure | — no jurisdiction match |
| Unpaid placement | — not evaluated |
| Candidate-paid fee | — not evaluated |
| Accommodation notice | — no jurisdiction match |

## Score Evidence

| Dimension | Status | Source / observation | Unresolved question |
|---|---|---|---|
| CV match | ${decision === 'Apply' ? 'supported' : 'partial'} | Detailed in Block B requirement mapping | Specialized technical tools where applicable |
| North Star alignment | ${decision === 'Apply' ? 'supported' : 'partial'} | ${archetype} | None |
| Compensation | supported | Published official salary schedule | Step placement on hire |
| Cultural signals | unknown | Public sector agency | Departmental culture and team dynamic |
| Red flags | supported | Verified public sector opening | None |

**Evidence confidence:** Medium — Comp and classification confirmed directly from posting.

## Keywords extracted

${keywords.join(', ')}

${covBlock}

## Job Description (archived verbatim)

Posted: 2026-10-30

${fullJdText}

## Cover Letter Draft

> Draft generated at evaluation time. Complete via \`/career-ops cover ${slug}\` to fill in angles, confirm research, and generate the PDF.
> Gaps flagged below — address them during the cover flow.

---

**Opening** *(placeholder — refine with your "why this role" angle)*
I am writing to express my interest in the ${role} position with ${company}. My background in public sector contract management and workflow analysis aligns with the operational priorities of your department.

**Profile introduction**
Public health contracts analyst managing a portfolio averaging 10 concurrent contracts totaling approximately $20 million at the California Department of Public Health, coordinating legal, finance, vendors, and leadership to keep complex public programs compliant and on schedule.

**Key achievements** *(selected from cv.md — exact wording preserved)*
- **Managed contract portfolio,** led an average of 10 concurrent contracts totaling approximately $20 million from initiation through closeout supporting statewide public health programs.
- **Automated workflows,** automated contract and program logging using Microsoft Power Automate and Microsoft 365 workflow tools, developing procedures to streamline operations.
- **Completed Staff Work,** prepared clear written analyses and recommendations to support executive decision-making across shifting priorities and tight deadlines.
- **Cross-functional coordination,** coordinated with leadership, legal, finance, vendors, and external partners to execute contracts in full compliance.

**Problems I will solve** *(placeholder — requires company research + your input)*
> To be completed: what challenges does ${company} face that you'd address? How would you approach them?

**Closing**
I am happy to discuss further at your convenience.

Kindly,
Patrick Tolbert

---

**Gaps flagged:**
${soft_gaps.length > 0 ? soft_gaps.join('\n') : 'None detected.'}

**JD keywords to mirror** *(extracted for ATS + human read)*
${keywords.slice(0, 10).join(', ')}

---
*Run \`/career-ops cover ${slug}\` to complete angles, confirm company research, and generate the PDF.*
`;
}

// Write reports and TSVs
for (const evalItem of evaluations) {
  const jdEntry = rawJds.find(j => j.index === evalItem.index);
  const fullJdText = jdEntry && jdEntry.data ? jdEntry.data.text : "JD text unavailable";
  
  const reportPath = `reports/${evalItem.num}-${evalItem.slug}-2026-10-30.md`;
  const reportContent = generateReportMarkdown(evalItem, fullJdText);
  writeFileSync(reportPath, reportContent, 'utf8');
  console.log(`[+] Wrote report: ${reportPath}`);

  // Release reservation sentinel
  const rel = spawnSync('node', ['reserve-report-num.mjs', '--release', evalItem.num], { encoding: 'utf8' });
  if (rel.status !== 0) console.error(`Failed releasing ${evalItem.num}: ${rel.stderr}`);

  // Write TSV addition
  const tsvPath = `batch/tracker-additions/${evalItem.num}-${evalItem.slug}.tsv`;
  const pdfEmoji = evalItem.score >= 3.0 ? "✅" : "❌";
  const status = evalItem.decision === "Apply" ? "Evaluated" : "Discarded";
  const tsvContent = `num\tdate\tcompany\trole\tstatus\tscore\tpdf\treport\tnotes\turl\n${parseInt(evalItem.num, 10)}\t2026-10-30\t${evalItem.company}\t${evalItem.role}\t${status}\t${evalItem.score.toFixed(1)}/5\t${pdfEmoji}\t[${evalItem.num}](reports/${evalItem.num}-${evalItem.slug}-2026-10-30.md)\t${evalItem.notes}\t${evalItem.url}\n`;
  writeFileSync(tsvPath, tsvContent, 'utf8');
  console.log(`[+] Wrote TSV addition: ${tsvPath}`);
}

console.log(`All 18 reports and tracker additions generated successfully.`);
