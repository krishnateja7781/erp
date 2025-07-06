
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name: string | null | undefined): string {
    if (!name) return '?';
    const nameParts = name.trim().split(' ');
    if (nameParts.length === 1 && name.length > 0) {
        return name.substring(0, Math.min(2, name.length)).toUpperCase();
    }
    if (nameParts.length > 1 && nameParts[0] && nameParts[nameParts.length - 1]) {
        return (nameParts[0][0] + (nameParts[nameParts.length - 1][0] || '')).toUpperCase();
    }
    return name.substring(0, Math.min(2, name.length)).toUpperCase();
};

export function formatDate(dateString: string | undefined | null, options?: Intl.DateTimeFormatOptions): string {
  if (!dateString) return "N/A";
  try {
    const defaultOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric', month: 'short', day: 'numeric',
    };
    return new Date(dateString).toLocaleDateString('en-US', options || defaultOptions);
  } catch (e) {
    console.error(`Invalid date string for formatDate: ${dateString}`, e);
    return "Invalid Date";
  }
}

export function generatePassword(firstName: string, dob: string): string | null {
  if (!firstName || !dob) return null;
  const namePart = firstName.substring(0, 3).toUpperCase();
  const dobDate = new Date(dob);
  if (isNaN(dobDate.getTime())) {
    console.error("Invalid DOB for password generation:", dob);
    return null;
  }
  const day = ('0' + dobDate.getDate()).slice(-2);
  const month = ('0' + (dobDate.getMonth() + 1)).slice(-2);
  return `${namePart}${day}${month}`;
};

export const getProgramCode = (program: string | undefined): string => {
  if (!program) return "XXX";
  const programCodes: Record<string, string> = { 
    "B.Tech": "BT",
    "MBA": "MBA",
    "Law": "LW",
    "MBBS": "MB",
    "B.Sc": "BS",
    "B.Com": "BCOM" // Standardized code
  };
  return programCodes[program] || program.substring(0, 2).toUpperCase();
};

export const getBranchCode = (branch: string | undefined, program: string | undefined): string => {
  if (!branch || !program) return "XX";
  const branchCodes: Record<string, Record<string, string>> = {
    "B.Tech": { "CSE": "CS", "ECE": "EC", "MECH": "ME", "IT": "IT", "AI&ML": "AI", "DS": "DS", "CIVIL": "CE", "Other": "OT" },
    "MBA": { "Marketing": "MK", "Finance": "FN", "HR": "HR", "Operations": "OP", "General": "GN", "Other": "OT"},
    "Law": { "Corporate Law": "CL", "Criminal Law": "CRML", "Civil Law": "CVL", "General": "GN", "Other": "OT"},
    "MBBS": { "General Medicine": "GM"}, 
    "B.Sc": { "Physics": "PH", "Chemistry": "CH", "Mathematics": "MA", "Computer Science": "CS", "Biotechnology": "BT", "Other": "OT"},
    "B.Com": { "General": "GN", "Accounting & Finance": "AF", "Taxation": "TX", "Corporate Secretaryship": "CS", "Other": "OT"},
  };
  const programBranches = branchCodes[program];
  if (programBranches && programBranches[branch]) {
    return programBranches[branch];
  }
  return branch.length >= 2 ? branch.substring(0,2).toUpperCase() : (branch.substring(0,1).toUpperCase() + "X");
};

export const getDepartmentCode = (department: string | undefined, program?: string | undefined): string => {
    if (!department) return "XX";

    const deptMap: Record<string, string> = {
        "Computer Science & Engineering": "CS",
        "Electronics & Communication Engineering": "EC",
        "Mechanical Engineering": "ME",
        "Information Technology": "IT",
        "Artificial Intelligence & Machine Learning": "AI",
        "Data Science": "DS",
        "Civil Engineering": "CE",
        "General Administration": "AD",
        "Accounts": "AC",
        "Administration": "AD",
        "Library": "LB",
        "IT Support": "IT",
        "Physics": "PH",
        "Chemistry": "CH",
        "Mathematics": "MA"
    };

    if (deptMap[department]) {
        return deptMap[department];
    }
    
    // Fallback logic
    if (department.toUpperCase().includes("CSE") || department.toUpperCase().includes("COMPUTER SCIENCE")) return "CS";
    if (department.toUpperCase().includes("ECE") || department.toUpperCase().includes("ELECTRONICS")) return "EC";
    if (department.toUpperCase().includes("MECH") || department.toUpperCase().includes("MECHANICAL")) return "ME";
    if (department.toUpperCase().includes("IT") || department.toUpperCase().includes("INFORMATION TECHNOLOGY")) return "IT";
    if (department.toUpperCase().includes("ADMINISTRATION")) return "AD";
    if (department.toUpperCase().includes("ACCOUNTS")) return "AC";
    if (department.toUpperCase().includes("LAW")) return "LW";
    if (department.toUpperCase().includes("MEDICINE") || department.toUpperCase().includes("MBBS")) return "MD";
    if (department.toUpperCase().includes("MBA")) return "BA";
    return department.substring(0, Math.min(department.length, 2)).toUpperCase();
};
