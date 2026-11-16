export function BrandLogo() {
  return (
    <div className="brand-logo">
      <svg className="brand-mark" viewBox="0 0 32 36" width="32" height="36" aria-hidden="true">
        <path
          fill="#080f3d"
          d="M14.5 1.9a3 3 0 0 1 3 0L29 8.6a3 3 0 0 1 1.5 2.6v13.6a3 3 0 0 1-1.5 2.6l-11.5 6.7a3 3 0 0 1-3 0L3 27.4a3 3 0 0 1-1.5-2.6V11.2A3 3 0 0 1 3 8.6Z"
        />
        <path
          fill="#2446d6"
          d="m2.2 26 4.9-4.5 8.6 4.1 7.8-10.4 7 3.3v6.3a3 3 0 0 1-1.5 2.6l-11.5 6.7a3 3 0 0 1-3 0L3 27.4a3 3 0 0 1-.8-1.4Z"
        />
        <path
          fill="none" stroke="#f7f9ff" strokeWidth="1.5" strokeLinejoin="round"
          d="M14.5 1.9a3 3 0 0 1 3 0L29 8.6a3 3 0 0 1 1.5 2.6v13.6a3 3 0 0 1-1.5 2.6l-11.5 6.7a3 3 0 0 1-3 0L3 27.4a3 3 0 0 1-1.5-2.6V11.2A3 3 0 0 1 3 8.6ZM2.2 26l4.9-4.5 8.6 4.1 7.8-10.4 7 3.3"
        />
        <g fill="#f7f9ff">
          <circle cx="7.1" cy="21.5" r="2.3"/>
          <circle cx="15.7" cy="25.6" r="2.3"/>
          <circle cx="23.5" cy="15.2" r="2.3"/>
        </g>
      </svg>
      <span className="brand-wordmark">
        <strong>GraphQL</strong>
        <span>Coverage Proxy</span>
      </span>
    </div>
  );
}
