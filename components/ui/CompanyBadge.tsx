import { cn, companyBadgeStyles, getCompanyForContainer } from "@/lib/utils";

export function CompanyBadge({ containerNumber }: { containerNumber: string }) {
  const company = getCompanyForContainer(containerNumber);
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
