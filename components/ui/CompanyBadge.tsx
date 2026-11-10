import { cn, companyBadgeStyles, getCompanyForContainer } from "@/lib/utils";
import type { Country } from "@/types";

export function CompanyBadge({
  containerNumber,
  country = "Uganda",
}: {
  containerNumber: string;
  country?: Country;
}) {
  const company = getCompanyForContainer(containerNumber, country);
  const style = companyBadgeStyles[company];

  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium",
        style.bg,
        style.text
      )}
    >
      {company}
    </span>
  );
}
