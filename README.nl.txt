Blader door bestanden op je FTP-server en automatiseer bestandsoverdrachten vanuit Homey. Bewaar camerabeelden, stuur rapporten naar je NAS of maak audiobestanden beschikbaar voor een geschikte speler.

• Beheer bestanden vanuit Homey: upload en download bestanden, maak mappen aan en hernoem, verplaats of verwijder bestanden en mappen.
• Automatiseer met Flow: sla afbeeldingen of base64-gecodeerde bestanden op, vraag een bestandslijst op als JSON, laad afbeeldingen in Flows of maak een tijdelijke downloadlink.
• Sla bestanden op vanaf URL's: stuur downloads via HTTP, HTTPS of FTP naar je server, inclusief logexportlinks van Simple (Sys) Log, zonder het bestand via een Flow-token door te geven.
• Ondersteuning voor Simple (Sys) Log: sla CSV-, Excel- of JSON-exports op met de speciale exportkaart, of verbind de export-URL-kaart met ‘Bestand opslaan vanaf URL’ voor grote logs.
• Bewaak je verbinding: Homey controleert de ingestelde map automatisch. Start Flows wanneer FTP niet meer beschikbaar is, weer bereikbaar is of een overdracht mislukt.

Voeg een apparaat van het type ‘FTP-verbinding’ toe en vul je servergegevens in. Bij het koppelen probeert Homey eerst beveiligde FTP (FTPS) en zo nodig gewone FTP. Als je een startmap kiest, blijven de bestandsweergave en bestandsbewerkingen via Flow binnen die map. Open Repareren bij het apparaat om je bestanden te bekijken in de Homey-app of webapp.

Werkt met FTP-servers, waaronder Micro Web Server.

Vereist de Better Logic Library-app. BLL-codering wordt ondersteund in tekstvelden voor bestandsnamen en paden. Bekijk de instellingen van de Better Logic Library-app voor uitleg over BLL-codering.

Bekijk het topic van deze app op het Homey Community Forum voor meer informatie.
Voor de FTP Client-wiki en gebruikershandleiding kies je ‘Bezoek website’ onder ‘Ontwikkelaarswebsite’ op de Homey App Store-pagina van deze app.
