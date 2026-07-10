export interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  category: "safety" | "quality" | "productivity" | "compliance" | "housekeeping";
  severity: "low" | "medium" | "high" | "critical";
  natural_language: string;
  scope_zones: string[];
  tags: string[];
  standard?: string;
}

export const POLICY_TEMPLATES: PolicyTemplate[] = [
  {
    id: "ppe-hardhat-zone-a",
    name: "Hard Hat Compliance – Restricted Zones",
    description: "Detect any personnel entering hard-hat zones without approved head protection.",
    category: "safety",
    severity: "high",
    natural_language:
      "All personnel entering Zone A, the loading bay, or any area marked as a hard-hat zone must wear an ANSI Z89.1-compliant hard hat at all times between 06:00 and 22:00. Flag any person detected in these zones without a hard hat, or wearing an unapproved head covering (baseball cap, hoodie only).",
    scope_zones: ["Zone A", "Loading Bay"],
    tags: ["PPE", "OSHA 1910.135", "Head protection"],
    standard: "OSHA 29 CFR 1910.135",
  },
  {
    id: "ppe-full-kit",
    name: "Full PPE Kit – Production Floor",
    description: "Require hard hat, high-vis vest, safety glasses, and steel-toe boots on the production floor.",
    category: "safety",
    severity: "high",
    natural_language:
      "Any person on the production floor must be wearing the full PPE kit: hard hat, high-visibility vest (Class 2 or higher), safety glasses, and closed-toe safety footwear. Flag partial compliance as medium severity; flag missing hard hat or vest as high severity.",
    scope_zones: ["Production Floor"],
    tags: ["PPE", "High-vis", "OSHA"],
    standard: "ANSI/ISEA 107",
  },
  {
    id: "forklift-pedestrian-2m",
    name: "Forklift–Pedestrian Separation (2 m)",
    description: "Detect any pedestrian within 2 metres of an operating forklift.",
    category: "safety",
    severity: "critical",
    natural_language:
      "No pedestrian may be within 2 metres of an operating forklift or powered industrial truck at any time. Detect proximity violations and fire a critical alert immediately. Pedestrians must use designated walkways marked in yellow. Flag any pedestrian crossing outside marked walkways in forklift zones.",
    scope_zones: ["Warehouse", "Loading Bay"],
    tags: ["Forklift", "Struck-by", "OSHA 1910.178"],
    standard: "OSHA 29 CFR 1910.178",
  },
  {
    id: "restricted-zone-access",
    name: "Restricted Zone Unauthorized Access",
    description: "Flag entry into restricted zones by anyone without a visible authorization badge.",
    category: "compliance",
    severity: "high",
    natural_language:
      "Only personnel with a visible authorization badge may enter restricted zones (electrical rooms, chemical storage, server rooms, executive floor). Flag any person entering a restricted zone without a visible badge, or tailgating another authorized person.",
    scope_zones: ["Electrical Room", "Chemical Storage"],
    tags: ["Access control", "Badging"],
    standard: "ISO 27001 A.11",
  },
  {
    id: "spill-detection",
    name: "Liquid Spill / Housekeeping Hazard",
    description: "Detect standing liquid, debris, or blocked aisles that create slip/trip hazards.",
    category: "housekeeping",
    severity: "medium",
    natural_language:
      "Detect standing liquid, spilled product, or debris on walking surfaces in any aisle or work area. Also flag pallets, boxes, or equipment blocking aisles or emergency egress paths. Fire alerts if hazard persists longer than 60 seconds without cleanup activity visible.",
    scope_zones: ["Production Floor", "Warehouse"],
    tags: ["Slip/trip", "5S", "Housekeeping"],
    standard: "OSHA 1910.22",
  },
  {
    id: "fire-exit-blocked",
    name: "Fire Exit / Egress Path Obstruction",
    description: "Fire exits and egress paths must remain unobstructed at all times.",
    category: "compliance",
    severity: "critical",
    natural_language:
      "Fire exits, fire doors, and marked egress paths must never be blocked by equipment, product, pallets, or personnel loitering. Detect any obstruction within 1 metre of a fire exit or in the marked egress corridor and fire a critical alert.",
    scope_zones: ["All zones"],
    tags: ["Fire safety", "NFPA", "Egress"],
    standard: "NFPA 101",
  },
  {
    id: "machine-guard",
    name: "Machine Guarding – Hands in Danger Zone",
    description: "Detect operator hands entering a machine's danger zone while it is running.",
    category: "safety",
    severity: "critical",
    natural_language:
      "No operator's hand, arm, or body part may enter the marked danger zone of a running press, conveyor pinch point, or moving machinery. Detect any hand-in-zone event while the machine is in motion and fire a critical alert with immediate stop recommendation.",
    scope_zones: ["Assembly Line", "Press Shop"],
    tags: ["Machine guarding", "Amputation prevention"],
    standard: "OSHA 29 CFR 1910.212",
  },
  {
    id: "smoking-vaping",
    name: "No Smoking / Vaping Detection",
    description: "Flag smoking or vaping in any indoor or non-designated area.",
    category: "compliance",
    severity: "high",
    natural_language:
      "Smoking, vaping, or use of any open-flame device is prohibited in all indoor areas and within 10 metres of chemical storage, fuel dispensers, or the loading dock. Detect any person smoking or vaping in these areas.",
    scope_zones: ["Indoor areas", "Fuel Dock", "Chemical Storage"],
    tags: ["Fire hazard", "Health & safety"],
  },
  {
    id: "mobile-phone-driving",
    name: "Mobile Phone Use While Operating Equipment",
    description: "Flag forklift or vehicle operators using a mobile phone while moving.",
    category: "safety",
    severity: "high",
    natural_language:
      "Operators of forklifts, powered pallet jacks, or vehicles must not use handheld mobile phones while the equipment is in motion. Detect any operator holding a phone to their ear or looking at a phone while behind the controls of moving equipment.",
    scope_zones: ["Warehouse", "Yard"],
    tags: ["Distracted operation", "Forklift"],
  },
  {
    id: "line-idle-downtime",
    name: "Production Line Idle > 5 min",
    description: "Detect production lines idle for more than 5 minutes without maintenance activity.",
    category: "productivity",
    severity: "medium",
    natural_language:
      "If a production line shows no output movement for more than 5 consecutive minutes without visible maintenance or changeover activity, flag as unplanned downtime and notify the shift supervisor.",
    scope_zones: ["Production Floor"],
    tags: ["OEE", "Downtime", "Availability"],
  },
  {
    id: "quality-defect-visual",
    name: "Visual Defect on Finished Goods",
    description: "Detect visible defects on finished goods at inspection station.",
    category: "quality",
    severity: "medium",
    natural_language:
      "At the final inspection station, detect visible defects on finished goods including: dents, scratches longer than 5 mm, discoloration, misaligned labels, or missing components. Log every defect with image evidence for quality traceability.",
    scope_zones: ["QC Station"],
    tags: ["Quality", "FPY", "Traceability"],
    standard: "ISO 9001",
  },
  {
    id: "ergonomic-lifting",
    name: "Improper Manual Lifting Posture",
    description: "Detect back-bent lifting posture with heavy loads.",
    category: "safety",
    severity: "low",
    natural_language:
      "Detect any worker lifting a package or load with a bent back (torso flexion greater than 45 degrees) instead of a knees-bent squat lift. Log as an ergonomic risk event for training and MSD-prevention analytics.",
    scope_zones: ["Warehouse", "Packing"],
    tags: ["Ergonomics", "MSD prevention"],
    standard: "NIOSH Lifting Equation",
  },
];
