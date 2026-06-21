"use client";

import Script from "next/script";

// GA4 via gtag direto (sem GTM). Measurement ID público por design em
// NEXT_PUBLIC_GA_ID. Sem o ID, não renderiza nada (degradação graciosa).
//
// Consent Mode v2: o consentimento entra DENIED por padrão (LGPD) ANTES de
// qualquer evento; o ConsentBanner faz o `consent update` no aceite.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function GoogleAnalytics() {
  if (!GA_ID) return null;

  return (
    <>
      {/* Lib do gtag */}
      <Script
        id="ga-src"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      {/* Bootstrap: dataLayer + gtag + consent default DENIED (antes do config). */}
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('consent', 'default', {
            ad_storage: 'denied',
            analytics_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
          });
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { send_page_view: true });
        `}
      </Script>
    </>
  );
}
