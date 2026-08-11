export const DEPARTMENT_SECTIONS = {
    CSE: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], // 9 sections (A to I)
    CSM: ['A', 'B', 'C', 'D', 'E'],                     // 5 sections (A to E)
    CSD: ['A', 'B', 'C', 'D', 'E'],                     // 5 sections (A to E)
    ECE: ['A', 'B', 'C', 'D', 'E'],                     // 5 sections (A to E)
    IT:  ['A', 'B', 'C', 'D'],                          // 4 sections (A to D)
    EEE: ['A', 'B', 'C', 'D'],                          // 4 sections (A to D)
    CIVIL: ['A', 'B', 'C', 'D'],                        // 4 sections (A to D)
    MECH:  ['A', 'B', 'C', 'D'],                        // 4 sections (A to D)
};

/**
 * Returns list of section labels ('A', 'B', ...) for a given department/branch.
 * For CSE: returns A to I (9 sections).
 * For CSM: returns A to E (5 sections).
 * For ALL/empty branch: returns combined sections.
 */
export const getSectionsForBranch = (branch, availableFromDB = []) => {
    if (!branch || branch === 'ALL' || branch === 'all' || branch === '') {
        const defaults = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
        const merged = Array.from(new Set([...defaults, ...(availableFromDB || [])])).sort();
        return merged;
    }
    const key = String(branch).toUpperCase();
    const branchSections = DEPARTMENT_SECTIONS[key] || ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    // Merge any DB sections matching that branch if present
    const merged = Array.from(new Set([...branchSections, ...(availableFromDB || [])])).sort();
    return merged;
};
