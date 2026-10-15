# Notifications Android/Fire TV

Zeig Benachrichtigungen auf deinem Fernseher aus Gladys an: eine Nachricht über dem Film, auf Wunsch
mit Bild. Der Klassiker: **Es klingelt an der Tür, das Bild des Besuchers erscheint auf dem
Fernseher**. Außerdem: Die Waschmaschine ist fertig, zur Schlafenszeit ist noch ein Fenster offen,
„Essen ist fertig!“ vom Küchentablet aus.

Es genügt eine kostenlose Benachrichtigungs-App auf dem Fernseher: **Notifications for Android TV**
(Android TV, Google TV, Nvidia Shield …), **Notifications for Fire TV** (Amazon Fire TV und Fire TV
Stick), **PiPup** oder **TvOverlay**. Jeder Fernseher wird zu einem Gladys-Gerät, das meldet, ob er
an ist (seine App antwortet): So kann eine Szene zwischen Fernseher und Handy wählen.

> **Ohne die Hardware entwickelt: Rückmeldungen willkommen.** Die Integration ist durch
> automatische Tests gegen simulierte Apps abgedeckt, wurde aber noch nicht mit einem echten
> Fernseher in einer echten Gladys-Installation ausprobiert. Erzähl uns im Gladys-Forum, wie sie mit
> deinem funktioniert.

Diese Integration ist nicht verbunden mit den Autoren dieser Apps, noch mit Google oder Amazon.

## Was du bekommst

- **Ein Gerät pro Fernseher** mit einer Funktion, **Erreichbar** (Anwesenheitssensor, ja/nein): ja,
  wenn die Benachrichtigungs-App des Fernsehers antwortet, also in der Praxis, wenn der Fernseher an
  ist.
- Eine Szenen-Aktion, **Benachrichtigung auf dem Fernseher anzeigen**: Titel, Nachricht
  (Szenenvariablen erlaubt), Anzeigedauer, Position, Hintergrundfarbe, Transparenz, Symbol und ein
  Bild, das von der Schnappschuss-URL einer Kamera geladen wird. Die Aktion meldet der Szene, ob die Benachrichtigung angezeigt wurde.
- Ein Dashboard-Widget, **Nachricht an den TV**: der Zustand des Fernsehers, eine Schaltfläche
  **Nachricht schreiben**, die ein kleines Formular öffnet, und bis zu drei Schnellnachrichten, ein
  Tippen pro Nachricht.
- Drei Schaltflächen in der Konfiguration: Fernseher hinzufügen oder ändern, Fernseher entfernen,
  Testbenachrichtigung senden.

## Voraussetzungen

- Gladys Assistant **5.2.0** oder neuer (das Formular des Widgets braucht es).
- Ein Fernseher mit Android TV, Google TV oder Fire OS im **selben lokalen Netzwerk** wie Gladys.
- Eine der Benachrichtigungs-Apps, auf dem Fernseher installiert und einmal geöffnet (nächster
  Abschnitt).
- Die Adresse des Fernsehers: eine IP-Adresse (am besten fest: reserviere sie in den
  DHCP-Einstellungen deines Routers) oder ein DNS-Name. `.local`-Namen (mDNS) werden von der
  Integration nicht aufgelöst.

## Die App auf dem Fernseher installieren

### Android TV, Google TV, Nvidia Shield

Installiere **Notifications for Android TV** aus dem Google Play Store des Fernsehers (suche nach
„Notifications for Android TV“) und öffne die App einmal: Die App zeigt die IP-Adresse des Fernsehers und fragt nach der Berechtigung, über anderen Apps anzuzeigen. Lass die App installiert: Die App hört im Hintergrund auf Port **7676**. Prüfe auf ihrer Store-Seite, welche Optionen ihre kostenlose Version
enthält.

### Fire TV

Installiere **Notifications for Fire TV** aus dem Amazon Appstore des Fire TV und öffne die App
einmal. Es ist dieselbe App für den Fire TV, mit demselben Protokoll: Wähle in Gladys
„Notifications for Android TV / Fire TV“.

### Stattdessen PiPup oder TvOverlay

- **PiPup** (Port **7979**) ist eine Open-Source-Alternative. Außerhalb des Play Store installiert,
  braucht sie die Berechtigung, über anderen Apps anzuzeigen, einmal per ADB erteilt:
  `adb shell appops set nl.rogro82.pipup SYSTEM_ALERT_WINDOW allow`.
- **TvOverlay** (Port **5001**) aus dem Play Store braucht dieselbe Berechtigung (derselbe
  ADB-Befehl mit `com.tabdeveloper.tvoverlay`). Das Aussehen der Benachrichtigungen (Farben,
  Layout) wählst du in der App selbst.

Unsere Integrationen
[Android TV Remote](https://github.com/guim31/gladys-integration-android-tv-remote) und
[Android TV ADB](https://github.com/guim31/gladys-androidtv-adb) **steuern** den Fernseher (Ein/Aus,
Lautstärke, Apps); diese hier **zeigt Nachrichten** darauf an. Beide arbeiten nebeneinander auf
demselben Fernseher. Ist ADB für die zweite schon eingerichtet, sendest du den Befehl oben mit
demselben ADB-Zugang von deinem Computer.

## Konfiguration

### Einstellungen

| Einstellung               | Standard | Zweck                                                                                             |
| ------------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| **Sprache**               | Français | Namen der Funktionen, Meldungen der Aktionen, Text der Testbenachrichtigung                       |
| **Fernseher prüfen alle** | 30 s     | wie oft die Integration prüft, ob jeder Fernseher antwortet                                       |
| **Nicht erreichbar nach** | 1 Minute | Zeit ohne Antwort, bevor ein Fernseher als nicht erreichbar gilt (das WLAN verpasst eine Prüfung) |

Eine Prüfung ist eine Verbindung zur App des Fernsehers: **Auf dem Bildschirm erscheint nichts**,
und der Fernseher wird nicht geweckt. Die Apps haben weder Konto noch Kontingent: Die Integration
spricht nur in deinem lokalen Netzwerk mit ihnen, nie über das Internet.

### Einen Fernseher hinzufügen

1. Fülle unter **Integrationen → Notifications Android/Fire TV → Konfiguration** die Aktion
   **Fernseher hinzufügen oder ändern** aus: einen Namen, die von der App angezeigte IP-Adresse und
   die installierte App. Lass den Port leer, außer du hast ihn in der App geändert.
2. Die Antwort sagt, ob die App antwortet. Wenn nicht, schalte den Fernseher ein, öffne die App
   einmal und starte die Aktion erneut.
3. Öffne den Tab **Entdecken** und lege das Gerät des Fernsehers an.

Dieselbe Aktion mit demselben Namen oder derselben Adresse aktualisiert den Fernseher (neue
Adresse, andere App): Sein Gerät bleibt dasselbe. **Fernseher entfernen** beendet die Prüfungen;
lösche auch sein Gerät in Gladys, wenn du es nicht mehr brauchst.

### Testen

**Testbenachrichtigung senden** mit dem in der Liste gewählten Fernseher zeigt eine kurze Nachricht
auf dem Bildschirm. Die Antwort sagt, was passiert ist: angezeigt, der Fernseher antwortet nicht,
oder die App hat die Benachrichtigung abgelehnt (falsche App gewählt oder anderer Port).

## Geräte

Jeder Fernseher ist ein Gerät mit einer Funktion:

| Funktion       | Typ in Gladys                | Zeigt                                                                        |
| -------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| **Erreichbar** | Anwesenheitssensor (ja/nein) | ja, wenn die App des Fernsehers antwortet (der Fernseher ist an), sonst nein |

Auf dem Dashboard benennt Gladys eine Funktion, die als einzige ihres Typs auf dem Gerät ist, mit
dem Namen des Typs: Die Gerätebox kann „Anwesenheit“ statt „Erreichbar“ anzeigen. Der Wert ist
derselbe.

Den Zustand aktualisiert die Integration selbst im gewählten Intervall, und sie veröffentlicht ihn
nur bei einer Änderung (plus einmal alle 12 Stunden, damit das Dashboard nie „Kein aktueller Wert“
anzeigt). Eine angezeigte Benachrichtigung markiert den Fernseher auch sofort als erreichbar.

Manche Fernseher lassen ihr Netzwerk im Standby an: Die App kann noch eine Weile antworten, nachdem
der Bildschirm aus ist. Der Zustand sagt „der Fernseher kann eine Benachrichtigung anzeigen“, und
genau das braucht eine Szene.

## Dashboard-Widget

**Nachricht an den TV** zeigt:

- den Zustand des Fernsehers (an und erreichbar, aus oder nicht erreichbar);
- **Nachricht schreiben**: Ein Tippen öffnet ein kleines Formular (Nachricht und Anzeigedauer),
  **Senden** zeigt sie auf dem Fernseher;
- bis zu drei **Schnellnachrichten**, einmal in den Einstellungen des Widgets geschrieben („Essen
  ist fertig!“, „Ab ins Bett!“), mit einem Tippen angezeigt.

Einstellungen: der Fernseher (leer: der erste Fernseher der Integration) und die drei
Schnellnachrichten. Nach jeder Nachricht sagt ein kurzer Hinweis, ob sie angezeigt wurde.

## Szenen-Aktion und Auslöser

**Benachrichtigung auf dem Fernseher anzeigen** (Kategorie „Integrationen“ des Szeneneditors):

| Feld                             | Zweck                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| **Fernseher**                    | der Fernseher (Pflicht)                                                                       |
| **Titel**                        | optional; Notifications for Android TV zeigt „Gladys“, wenn er leer ist                       |
| **Nachricht**                    | der Text (Pflicht); Szenenvariablen erlaubt, z. B. der Name eines Geräts oder eine Temperatur |
| **Anzeigedauer (Sekunden)**      | 1 bis 300, standardmäßig 10                                                                   |
| **Position**                     | eine Ecke des Bildschirms oder seine Mitte (TvOverlay: nur Ecken)                             |
| **Hintergrundfarbe**             | neun Farben (nicht mit TvOverlay, das sein eigenes Layout verwendet)                          |
| **Transparenz des Hintergrunds** | deckend bis ganz transparent (nicht mit TvOverlay)                                            |
| **Symbol**                       | Türklingel, Kamera, Paket, Waschmaschine, Essen … (nicht mit PiPup)                           |
| **Bild-URL**                     | optional: ein Bild, das bei jeder Benachrichtigung geladen wird, siehe unten                  |

Die Aktion liefert **Benachrichtigung angezeigt (1 oder 0)**. Ein ausgeschalteter Fernseher ist
kein Fehler: Der Wert ist 0 und die Szene läuft weiter, sodass ein Schritt **Nur fortfahren, wenn**
die Nachricht stattdessen an ein Handy senden kann. Nur ein Gerät einer anderen Integration oder
eine Benachrichtigung ohne Text lassen die Aktion scheitern.

Die Integration deklariert **keinen Szenen-Auslöser**: Was dem Fernseher passiert, ist seine
Funktion **Erreichbar**, nutzbar im üblichen Auslöser „Zustandsänderung eines Geräts“ (der
Fernseher geht an oder aus).

### Bild einer Kamera

Die Integration kann das Bild eines Kamera-Geräts von Gladys nicht lesen: Gladys gibt einer
Integration nur Zugriff auf ihre eigenen Geräte. Die Integration lädt das Bild deshalb im Moment der
Benachrichtigung von der **Schnappschuss-URL der Kamera**. Beispiele:

- die meisten IP-Kameras: `http://192.168.1.40/snapshot.jpg` oder die URL aus ihrer Anleitung
  (Hikvision `http://192.168.1.40/ISAPI/Streaming/channels/101/picture`, Reolink
  `http://192.168.1.40/cgi-bin/api.cgi?cmd=Snap&channel=0&user=…&password=…`);
- Frigate: `http://192.168.1.50:5000/api/front_door/latest.jpg`;
- go2rtc: `http://192.168.1.50:1984/api/frame.jpeg?src=front_door`.

Benutzername und Passwort können in der URL stehen (`http://viewer:passwort@192.168.1.40/…`): Die
Integration beantwortet damit die Basic- oder Digest-Abfrage der Kamera und schreibt sie nie in ihre
Protokolle. **Eine Szene ist für alle Gladys-Benutzer lesbar**: Lege für diesen Zweck ein
Kamerakonto an, das nur ansehen darf.

Das Bild muss ein JPEG, PNG, GIF oder WebP von höchstens 4 MB sein, in höchstens 6 Sekunden
geladen. Scheitert der Download, wird die Benachrichtigung ohne Bild angezeigt.

## Szenenbeispiele

- **Wer ist an der Tür**: Auslöser „die Klingeltaste wird gedrückt“ → **Benachrichtigung auf dem
  Fernseher anzeigen** mit dem Titel „Türklingel“, der Nachricht „Jemand ist an der Tür“, dem
  Türklingel-Symbol, 30 Sekunden Anzeigedauer und der Schnappschuss-URL der Eingangskamera. Das Bild
  des Besuchers erscheint über dem Film.
- **Fernseher oder Handy**: dieselbe Szene, gefolgt von **Nur fortfahren, wenn**
  „Benachrichtigung angezeigt“ gleich 0 ist, dann **Nachricht senden** an dein Handy: Ist der
  Fernseher aus, übernimmt das Handy.
- **Wäsche fertig**: Auslöser „die Leistung der Waschmaschinen-Steckdose fällt unter 5 W“ →
  Benachrichtigung „Die Wäsche ist fertig“ mit dem Waschmaschinen-Symbol, nur wenn die Funktion
  **Erreichbar** des Fernsehers ja ist.
- **Schlafenszeit**: an Schultagen um 21 Uhr → Benachrichtigung „In 10 Minuten ins Bett!“ in der
  Mitte des Bildschirms, in Bernstein.

## Fehlerbehebung

- **„antwortet nicht“**: Der Fernseher ist aus, im Tiefschlaf, oder die App läuft nicht. Öffne die
  App einmal auf dem Fernseher; erlaube auf manchen Fernsehern ihren Start im Hintergrund oder
  schalte die Akku-Optimierung für sie ab. Prüfe die von der App angezeigte IP-Adresse.
- **„hat die Benachrichtigung abgelehnt (HTTP 404 oder 400)“**: Eine andere App antwortet auf
  diesem Port. Prüfe die in **Fernseher hinzufügen oder ändern** gewählte App und den Port, falls du
  ihn in der App geändert hast.
- **Nichts auf dem Bildschirm, aber „angezeigt“**: Der App fehlt die Berechtigung, über anderen Apps
  anzuzeigen (siehe den ADB-Befehl oben), oder eine Vollbild-App verdeckt Überlagerungen.
- **Kein Bild**: Öffne die Schnappschuss-URL im Browser eines Computers im selben Netzwerk; prüfe
  Benutzername und Passwort sowie die Protokolle der Integration (eine Warnung pro fehlerhafter URL,
  Passwort verborgen).
- **Der Zustand bleibt „nicht erreichbar“, obwohl der Fernseher an ist**: Der Gladys-Rechner und der
  Fernseher müssen im selben Netzwerk sein, ohne Client-Isolation (das Gast-WLAN blockiert sie oft).
- Mehr Details: Setze `LOG_LEVEL=debug` für die Integration, um jede Prüfung und jede
  Benachrichtigung zu sehen.

## Grenzen

- Nur lokales Netzwerk: Die Integration spricht per HTTP in deinem Netzwerk mit der App des
  Fernsehers; keine Cloud, kein Konto.
- Kein Bild eines Kamera-Geräts von Gladys selbst (siehe oben): Eine Schnappschuss-URL ist nötig.
- Die Apps unterscheiden sich: keine Farben, keine Transparenz und keine Mitte mit TvOverlay, kein
  Symbol mit PiPup.
- Kein Auslesen dessen, was der Fernseher zeigt, keine Steuerung des Fernsehers: Dafür gibt es
  unsere Integrationen Android TV Remote und Android TV ADB.
- Die Benachrichtigungen erscheinen über den meisten Inhalten, aber manche geschützten oder
  Vollbild-Apps können sie verdecken.
- Noch nicht an echten Fernsehern ausprobiert (siehe Hinweis oben): Rückmeldungen willkommen.
