import { AppUser } from '../types/roles';

export function getAuthorizedClasses(user: AppUser | null, allClassOptions: string[]): string[] {
  if (user?.activeRole === 'teacher' && user.classAssignments && user.classAssignments.length > 0) {
    const assigned = new Set(user.classAssignments.map((ca: any) => ca.classLevel as string));
    // Preserve canonical STANDARD_OPTIONS order
    return allClassOptions.filter(cls => assigned.has(cls));
  }
  return allClassOptions;
}

export function getAuthorizedCatalogItems<T>(
  user: AppUser | null,
  catalog: T[],
  getClassLevel: (item: T) => string,
  getSubject: (item: T) => string,
  selectedClassLevel?: string
): T[] {
  let filtered = catalog;

  // Class-level pre-filter
  if (selectedClassLevel) {
    filtered = filtered.filter(item => getClassLevel(item).trim() === selectedClassLevel.trim());
  }

  // Teacher access restriction: build allowed (classLevel, subject) pairs
  if (user?.activeRole === 'teacher' && user.classAssignments && user.classAssignments.length > 0) {
    // Key: "classLevel|subject" — avoids cross-class subject leakage
    const allowedKeys = new Set<string>();

    user.classAssignments.forEach((ca: any) => {
      // Skip classes that don't match the pre-selected class level
      if (selectedClassLevel && ca.classLevel !== selectedClassLevel.trim()) return;

      if (ca.allSubjects) {
        // Allow every subject that exists in the catalog for this class
        catalog.forEach(item => {
          if (getClassLevel(item).trim() === ca.classLevel) {
            allowedKeys.add(`${ca.classLevel}|${getSubject(item).trim()}`);
          }
        });
      } else {
        // Allow only explicitly assigned subjects
        (ca.assignedSubjects as string[]).forEach(sub => {
          allowedKeys.add(`${ca.classLevel}|${sub.trim()}`);
        });
      }
    });

    filtered = filtered.filter(item =>
      allowedKeys.has(`${getClassLevel(item).trim()}|${getSubject(item).trim()}`)
    );
  }

  return filtered;
}

export function getAuthorizedSubjects<T>(
  user: AppUser | null,
  catalog: T[],
  getClassLevel: (item: T) => string,
  getSubject: (item: T) => string,
  selectedClassLevel?: string
): string[] {
  const filtered = getAuthorizedCatalogItems(user, catalog, getClassLevel, getSubject, selectedClassLevel);
  return [...new Set(filtered.map(item => getSubject(item).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
