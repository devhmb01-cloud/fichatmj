export type FamilySummary = {
  id: string;
  family_code: string;
  responsible_name: string;
  city: string | null;
  number_of_children: number;
  status: string;
};
export type FamilyListResult =
  | { ok: true; rows: FamilySummary[]; count: number; page: number }
  | { ok: false; message: string };
