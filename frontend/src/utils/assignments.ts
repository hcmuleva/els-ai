import { AppUser } from '../types/roles';

export function getAuthorizedClasses(user: AppUser | null, allClassOptions: string[]): string[] {
  if (user?.activeRole === 'teacher' && user.classAssignments && user.classAssignments.length > 0) {
    const assigned = new Set(user.classAssignments.map((ca: any) => ca.classLevel as string));
    assigned.add('ANY');
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
  const clUpper = (selectedClassLevel || '').trim().toUpperCase();
  if (selectedClassLevel && selectedClassLevel.trim() !== '' && clUpper !== 'ALL' && clUpper !== 'ANY') {
    filtered = filtered.filter(item => {
      const itemCl = getClassLevel(item).trim();
      return itemCl === selectedClassLevel.trim() || itemCl === 'ANY' || !itemCl;
    });
  }

  // Teacher access restriction: build allowed (classLevel, subject) pairs
  if (user?.activeRole === 'teacher' && user.classAssignments && user.classAssignments.length > 0) {
    const hasGlobalAll = user.classAssignments.some((ca: any) => (ca.classLevel === 'ANY' || !ca.classLevel) && ca.allSubjects);
    if (!hasGlobalAll) {
      const allowedKeys = new Set<string>();

      user.classAssignments.forEach((ca: any) => {
        if (ca.allSubjects) {
          catalog.forEach(item => {
            const itemCl = getClassLevel(item).trim();
            if (itemCl === ca.classLevel || itemCl === 'ANY' || ca.classLevel === 'ANY') {
              allowedKeys.add(`${ca.classLevel}|${getSubject(item).trim()}`);
              allowedKeys.add(`ANY|${getSubject(item).trim()}`);
            }
          });
        } else {
          (ca.assignedSubjects as string[] || []).forEach(sub => {
            allowedKeys.add(`${ca.classLevel}|${sub.trim()}`);
            allowedKeys.add(`ANY|${sub.trim()}`);
          });
        }
      });

      filtered = filtered.filter(item => {
        const itemCl = getClassLevel(item).trim();
        if (itemCl === 'ANY') return true;
        return allowedKeys.has(`${itemCl}|${getSubject(item).trim()}`) || allowedKeys.has(`ANY|${getSubject(item).trim()}`);
      });
    }
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
