Przeglądaj pliki na serwerze FTP i automatyzuj przesyłanie plików z Homey. Zapisuj zdjęcia z kamer, wysyłaj raporty na swój NAS lub udostępniaj pliki audio zgodnym odtwarzaczom.

• Zarządzaj plikami w Homey: przesyłaj i pobieraj pliki, twórz foldery oraz zmieniaj nazwy, przenoś i usuwaj pliki i foldery.
• Automatyzuj za pomocą Flow: zapisuj obrazy lub pliki zakodowane w base64, pobieraj listy plików w formacie JSON, wczytuj obrazy do Flow lub twórz tymczasowe linki do pobrania.
• Zapisuj pliki z adresów URL: przesyłaj pliki pobierane przez HTTP, HTTPS lub FTP na swój serwer, w tym z linków eksportu Simple (Sys) Log, bez przekazywania pliku przez token Flow.
• Obsługa Simple (Sys) Log: zapisuj eksporty CSV, Excel lub JSON za pomocą dedykowanej karty eksportu albo połącz kartę adresu URL eksportu z kartą „Zapisz plik z adresu URL” w przypadku dużych dzienników.
• Monitoruj połączenie: Homey automatycznie sprawdza skonfigurowany folder. Uruchamiaj Flow, gdy FTP przestanie działać, znów będzie dostępny lub transfer się nie powiedzie.

Dodaj urządzenie typu „Połączenie FTP” i podaj dane serwera. Podczas parowania Homey najpierw próbuje połączenia szyfrowanego (FTPS), a w razie potrzeby przechodzi na nieszyfrowane FTP. Jeśli wybierzesz folder początkowy, przeglądanie i operacje na plikach w Flow będą ograniczone do tego folderu. Otwórz ekran naprawy urządzenia, aby przeglądać pliki w aplikacji Homey lub w przeglądarce.

Obsługuje serwery FTP, w tym Micro Web Server.

Wymaga aplikacji Better Logic Library. Kod BLL jest obsługiwany w polach tekstowych nazwy pliku i ścieżki. Instrukcje korzystania z kodu BLL znajdziesz w ustawieniach aplikacji Better Logic Library.

Więcej informacji znajdziesz w wątku poświęconym tej aplikacji na forum społeczności Homey.
Aby otworzyć wiki i instrukcję obsługi FTP Client, wybierz „Odwiedź stronę” w sekcji „Strona www twórców aplikacji” na stronie aplikacji w Homey App Store.
