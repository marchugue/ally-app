export interface OrganizationLookup { name: string; sort_order: number; }
export interface DepartmentLookup { id: string; name: string; sort_order: number; }
export interface CourseLookup { name: string; department_id: string; sort_order: number; }
export interface InterestLookup { name: string; category: string; color: string; sort_order: number; }

export interface Lookups {
  organizations: OrganizationLookup[];
  departments: DepartmentLookup[];
  courses: CourseLookup[];
  interests: InterestLookup[];
}