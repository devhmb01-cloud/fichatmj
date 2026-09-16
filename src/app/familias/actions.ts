"use server";
import { z } from "zod";
import { requireTeam } from "@/lib/auth";
import { statuses } from "@/lib/families/validation";
import type { FamilyListResult } from "@/lib/families/list-types";
export async function searchFamilies(
  input: unknown,
): Promise<FamilyListResult> {
  const session = await requireTeam();
  if (!session) return { ok: true, rows: [], count: 0, page: 1 };
  const parsed = z
    .object({
      query: z.string().trim().max(80),
      status: z.enum(["", ...statuses]),
      page: z.number().int().min(1).max(10000),
    })
    .safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Confira os filtros informados." };
  const { query, status, page } = parsed.data;
  let request = session.client
    .from("families")
    .select(
      "id, family_code, responsible_name, city, number_of_children, status",
      { count: "exact" },
    );
  if (query)
    request = request.ilike(
      "responsible_name",
      `%${query.replace(/[\\%_]/g, "\\$&")}%`,
    );
  if (status) request = request.eq("status", status);
  const { data, count, error } = await request
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * 20, page * 20 - 1);
  if (error)
    return {
      ok: false,
      message: "Não foi possível buscar as famílias. Tente novamente.",
    };
  return { ok: true, rows: data ?? [], count: count ?? 0, page };
}
