import type { SVGProps } from "react";

export function DiscordIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.79 0 3.48-.46 4.97-1.29l-1.04-2.1c-.5.26-1.04.49-1.61.69-1.31.48-2.73.7-4.22.7-4.02 0-7.3-2.9-7.3-6.5S7.98 5.5 12 5.5s7.3 2.9 7.3 6.5c0 .9-.18 1.75-.5 2.53l2.06 1.03c.53-1.23.84-2.59.84-4.06 0-5.52-4.48-10-10-10zM7.5 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm9 0c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z" />
    </svg>
  );
}
