import { useQuery } from "@tanstack/react-query";
import { fetchPublicWcif, type Wcif } from "./wca";

/** Loads and caches a competition's public WCIF. */
export function useWcif(competitionId: string | undefined) {
  return useQuery<Wcif>({
    queryKey: ["wcif", competitionId],
    queryFn: ({ signal }) => fetchPublicWcif(competitionId!, signal),
    enabled: !!competitionId,
  });
}
