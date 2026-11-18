Gennemse filer på din FTP-server, og automatiser overførsler fra Homey. Gem kamerabilleder, send rapporter til din NAS, eller gør lydfiler tilgængelige for en kompatibel afspiller.

• Administrer filer fra Homey: Upload og download filer, opret mapper, og omdøb, flyt eller slet filer og mapper.
• Automatiser med Flow: Gem billeder eller base64-kodede filer, hent fillister som JSON, indlæs billeder i Flows, eller opret midlertidige downloadlinks.
• Gem filer fra URL'er: Overfør HTTP-, HTTPS- eller FTP-downloads til din server, herunder eksportlinks fra Simple (Sys) Log, uden at sende filen gennem et Flow-tag.
• Understøttelse af Simple (Sys) Log: Gem CSV-, Excel- eller JSON-eksporter med det særlige eksportkort, eller forbind eksport-URL-kortet med »Gem fil fra URL« til store logfiler.
• Overvåg forbindelsen: Homey kontrollerer automatisk den valgte mappe. Start Flows, når FTP bliver utilgængelig, bliver tilgængelig igen, eller en overførsel mislykkes.

Tilføj en enhed af typen »FTP-forbindelse«, og indtast serveroplysningerne. Ved parring prøver Homey først sikker FTP (FTPS) og bruger om nødvendigt ukrypteret FTP. Hvis du vælger en startmappe, er filvisningen og filhandlinger i Flows begrænset til den mappe. Åbn enhedens reparationsskærm for at se filerne i Homey-appen eller webappen.

Fungerer med FTP-servere, herunder Micro Web Server.

Kræver appen Better Logic Library. BLL-kode understøttes i tekstfelter til filnavne og stier. Se indstillingerne i appen Better Logic Library for vejledning i brug af BLL-kode.

Se appens tråd på Homeys Community Forum for at få mere at vide.
Du finder FTP Client-wikien og brugervejledningen ved at vælge "Besøg hjemmeside" under "Udviklers hjemmeside" på appens side i Homey App Store.
