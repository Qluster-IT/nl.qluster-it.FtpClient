Bla gjennom filer på FTP-serveren din og automatiser overføringer fra Homey. Lagre kamerabilder, send rapporter til en NAS eller gjør lydfiler tilgjengelige for en kompatibel avspiller.

• Administrer filer fra Homey: Last opp og ned filer, opprett mapper, og gi filer og mapper nytt navn, flytt dem eller slett dem.
• Automatiser med Flow: Lagre bilder eller base64-kodede filer, hent fillister som JSON, last inn bilder i Flows eller opprett en midlertidig nedlastingslenke.
• Lagre filer fra URL-er: Overfør HTTP-, HTTPS- eller FTP-nedlastinger til serveren din, inkludert eksportlenker fra Simple (Sys) Log, uten å sende filen gjennom en Flow-brikke.
• Støtte for Simple (Sys) Log: Lagre CSV-, Excel- eller JSON-eksporter med det egne eksportkortet, eller koble eksport-URL-kortet til «Lagre fil fra URL» for store logger.
• Overvåk tilkoblingen: Homey sjekker den valgte mappen automatisk. Start Flows når FTP blir utilgjengelig, blir tilgjengelig igjen eller en overføring mislykkes.

Legg til en enhet av typen «FTP-tilkobling» og oppgi serverinformasjonen. Ved paring prøver Homey sikker FTP (FTPS) først og bruker ukryptert FTP om nødvendig. Hvis du velger en startmappe, er filvisningen og filhandlingene i Flows begrenset til den. Åpne reparasjonsskjermen på enheten for å bla gjennom filer i Homey-appen eller nettappen.

Fungerer med FTP-servere, inkludert Micro Web Server.

Krever appen Better Logic Library. BLL-kode støttes i tekstfelt for filnavn og stier. Se innstillingene i appen Better Logic Library for veiledning i bruk av BLL-kode.

Se tråden om appen på Homeys samfunnsforum for mer informasjon.
For å åpne FTP Client-wikien og brukerveiledningen velger du "Besøk nettsted" under "Utviklerens nettsted" på appens side i Homey App Store.
