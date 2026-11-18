Durchsuche Dateien auf deinem FTP-Server und automatisiere Übertragungen mit Homey. Speichere Kameraaufnahmen, sende Berichte an dein NAS oder stelle Audiodateien für einen kompatiblen Player bereit.

• Verwalte Dateien in Homey: Lade Dateien hoch und herunter, erstelle Ordner und benenne Dateien und Ordner um, verschiebe oder lösche sie.
• Automatisiere mit Flow: Speichere Bilder oder Base64-kodierte Dateien, rufe Dateilisten als JSON ab, lade Bilder in Flows oder erstelle einen temporären Downloadlink.
• Speichere Dateien von URLs: Übertrage Downloads über HTTP, HTTPS oder FTP auf deinen Server, einschließlich Log-Exportlinks aus Simple (Sys) Log, ohne die Datei über ein Flow-Token weiterzugeben.
• Unterstützung für Simple (Sys) Log: Speichere CSV-, Excel- oder JSON-Exporte mit der speziellen Exportkarte oder verbinde dessen Export-URL-Karte mit „Datei von URL speichern“ für große Protokolle.
• Überwache deine Verbindung: Homey prüft den eingestellten Ordner automatisch. Starte Flows, wenn FTP nicht mehr verfügbar oder wieder erreichbar ist oder eine Übertragung fehlschlägt.

Füge ein Gerät vom Typ „FTP-Verbindung“ hinzu und gib deine Serverdaten ein. Beim Koppeln versucht Homey zuerst sicheres FTP (FTPS) und nutzt bei Bedarf unverschlüsseltes FTP. Wenn du einen Startordner auswählst, bleiben die Dateiansicht und alle Dateivorgänge in Flows auf diesen Ordner beschränkt. Öffne am Gerät den Reparaturbildschirm, um deine Dateien in der Homey-App oder Web-App zu durchsuchen.

Funktioniert mit FTP-Servern, darunter Micro Web Server.

Erfordert die App Better Logic Library. BLL-Code wird in Textfeldern für Dateinamen und Pfade unterstützt. Eine Anleitung für BLL-Code findest du in den Einstellungen der App Better Logic Library.

Weitere Informationen findest du im Thema zu dieser App im Homey Community-Forum.
Für das FTP Client-Wiki und das Benutzerhandbuch wähle auf der Homey App Store-Seite dieser App unter „Entwickler-Website“ die Option „Website besuchen“.
