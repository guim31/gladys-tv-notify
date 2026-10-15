// -----------------------------------------------------------------------------
// Texts sent from the container (action messages, connection status, errors,
// the test notification), in the four languages of the Gladys interface.
// Entries are strings or functions of one parameter object. German says "du",
// Spanish "usted". Brand and app names are never translated.
// -----------------------------------------------------------------------------

export const INIT_FAILED = {
  en: 'Initialization failed, check the integration logs.',
  fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
  de: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
  es: 'La inicialización ha fallado, consulte los registros de la integración.',
};

// Validation errors of the "Add or update a TV" action (keys: src/tvs.js).
export const ERRORS = {
  en: {
    name: 'Give the TV a name.',
    nameLength: 'The name is too long (60 characters at most).',
    address: ({ value }) => `"${value}" is not an IPv4 address or a host name.`,
    mdns: ({ value }) =>
      `"${value}" is an mDNS name, which the integration cannot resolve: enter the IP address.`,
    port: ({ value }) => `"${value}" is not a port (1 to 65535).`,
    tooMany: ({ max }) => `The list is full (${max} TVs).`,
  },
  fr: {
    name: 'Donnez un nom à la TV.',
    nameLength: 'Le nom est trop long (60 caractères au plus).',
    address: ({ value }) => `« ${value} » n'est ni une adresse IPv4 ni un nom d'hôte.`,
    mdns: ({ value }) =>
      `« ${value} » est un nom mDNS, que l'intégration ne peut pas résoudre : saisissez l'adresse IP.`,
    port: ({ value }) => `« ${value} » n'est pas un port (1 à 65535).`,
    tooMany: ({ max }) => `La liste est pleine (${max} TV).`,
  },
  de: {
    name: 'Gib dem Fernseher einen Namen.',
    nameLength: 'Der Name ist zu lang (höchstens 60 Zeichen).',
    address: ({ value }) => `„${value}“ ist weder eine IPv4-Adresse noch ein Hostname.`,
    mdns: ({ value }) =>
      `„${value}“ ist ein mDNS-Name, den die Integration nicht auflösen kann: Gib die IP-Adresse ein.`,
    port: ({ value }) => `„${value}“ ist kein Port (1 bis 65535).`,
    tooMany: ({ max }) => `Die Liste ist voll (${max} Fernseher).`,
  },
  es: {
    name: 'Dé un nombre al televisor.',
    nameLength: 'El nombre es demasiado largo (60 caracteres como máximo).',
    address: ({ value }) => `«${value}» no es una dirección IPv4 ni un nombre de equipo.`,
    mdns: ({ value }) =>
      `«${value}» es un nombre mDNS que la integración no puede resolver: introduzca la dirección IP.`,
    port: ({ value }) => `«${value}» no es un puerto (de 1 a 65535).`,
    tooMany: ({ max }) => `La lista está llena (${max} televisores).`,
  },
};

// Reports of the Configuration screen actions.
export const REPORTS = {
  en: {
    added: ({ name }) => `TV "${name}" added.`,
    updated: ({ name }) => `TV "${name}" updated.`,
    answers: ({ app, port }) => `${app} answers on port ${port}.`,
    silent: ({ app, port }) =>
      `${app} does not answer on port ${port} yet: turn the TV on and open the app once.`,
    discovery: 'Open the Discover tab to create its device.',
    removed: ({ name }) => `TV "${name}" removed.`,
    tvs: ({ count }) => `TVs left: ${count}.`,
    notFound: ({ query }) => `No TV is named "${query}" or has this address.`,
    testSent: ({ name }) => `Test notification shown on ${name}.`,
  },
  fr: {
    added: ({ name }) => `TV « ${name} » ajoutée.`,
    updated: ({ name }) => `TV « ${name} » modifiée.`,
    answers: ({ app, port }) => `${app} répond sur le port ${port}.`,
    silent: ({ app, port }) =>
      `${app} ne répond pas encore sur le port ${port} : allumez la TV et ouvrez l'appli une fois.`,
    discovery: "Ouvrez l'onglet Découverte pour créer son appareil.",
    removed: ({ name }) => `TV « ${name} » retirée.`,
    tvs: ({ count }) => `TV restantes : ${count}.`,
    notFound: ({ query }) => `Aucune TV ne s'appelle « ${query} » ni n'a cette adresse.`,
    testSent: ({ name }) => `Notification de test affichée sur ${name}.`,
  },
  de: {
    added: ({ name }) => `Fernseher „${name}“ hinzugefügt.`,
    updated: ({ name }) => `Fernseher „${name}“ geändert.`,
    answers: ({ app, port }) => `${app} antwortet auf Port ${port}.`,
    silent: ({ app, port }) =>
      `${app} antwortet noch nicht auf Port ${port}: Schalte den Fernseher ein und öffne die App einmal.`,
    discovery: 'Öffne den Tab „Entdecken“, um sein Gerät anzulegen.',
    removed: ({ name }) => `Fernseher „${name}“ entfernt.`,
    tvs: ({ count }) => `Verbleibende Fernseher: ${count}.`,
    notFound: ({ query }) => `Kein Fernseher heißt „${query}“ oder hat diese Adresse.`,
    testSent: ({ name }) => `Testbenachrichtigung auf ${name} angezeigt.`,
  },
  es: {
    added: ({ name }) => `Televisor «${name}» añadido.`,
    updated: ({ name }) => `Televisor «${name}» modificado.`,
    answers: ({ app, port }) => `${app} responde en el puerto ${port}.`,
    silent: ({ app, port }) =>
      `${app} aún no responde en el puerto ${port}: encienda el televisor y abra la aplicación una vez.`,
    discovery: 'Abra la pestaña Descubrir para crear su dispositivo.',
    removed: ({ name }) => `Televisor «${name}» eliminado.`,
    tvs: ({ count }) => `Televisores restantes: ${count}.`,
    notFound: ({ query }) => `Ningún televisor se llama «${query}» ni tiene esta dirección.`,
    testSent: ({ name }) => `Notificación de prueba mostrada en ${name}.`,
  },
};

// Failures of a notification (scene action, widget, test action).
export const NOTIFY_ERRORS = {
  en: {
    unknown: 'This device is not a TV of the Notifications Android/Fire TV integration.',
    empty: 'The notification has neither a title nor a message.',
    unreachable: ({ name }) =>
      `${name} does not answer: is the TV on, with its notification app installed?`,
    refused: ({ name, status }) =>
      `${name} refused the notification (HTTP ${status}): check the app and the port of the TV.`,
  },
  fr: {
    unknown: "Cet appareil n'est pas une TV de l'intégration Notifications Android/Fire TV.",
    empty: "La notification n'a ni titre ni message.",
    unreachable: ({ name }) =>
      `${name} ne répond pas : la TV est-elle allumée, avec son appli de notifications installée ?`,
    refused: ({ name, status }) =>
      `${name} a refusé la notification (HTTP ${status}) : vérifiez l'appli et le port de la TV.`,
  },
  de: {
    unknown: 'Dieses Gerät ist kein Fernseher der Integration Notifications Android/Fire TV.',
    empty: 'Die Benachrichtigung hat weder Titel noch Nachricht.',
    unreachable: ({ name }) =>
      `${name} antwortet nicht: Ist der Fernseher an und die Benachrichtigungs-App installiert?`,
    refused: ({ name, status }) =>
      `${name} hat die Benachrichtigung abgelehnt (HTTP ${status}): Prüfe die App und den Port des Fernsehers.`,
  },
  es: {
    unknown: 'Este dispositivo no es un televisor de la integración Notifications Android/Fire TV.',
    empty: 'La notificación no tiene ni título ni mensaje.',
    unreachable: ({ name }) =>
      `${name} no responde: ¿está encendido el televisor, con su aplicación de notificaciones instalada?`,
    refused: ({ name, status }) =>
      `${name} ha rechazado la notificación (HTTP ${status}): compruebe la aplicación y el puerto del televisor.`,
  },
};

// The notification of the "Send a test notification" action, shown on the TV.
export const TEST_NOTIFICATION = {
  en: { title: 'Gladys', message: 'Test notification: Gladys can show messages on this TV.' },
  fr: {
    title: 'Gladys',
    message: 'Notification de test : Gladys peut afficher des messages sur cette TV.',
  },
  de: {
    title: 'Gladys',
    message: 'Testbenachrichtigung: Gladys kann Nachrichten auf diesem Fernseher anzeigen.',
  },
  es: {
    title: 'Gladys',
    message: 'Notificación de prueba: Gladys puede mostrar mensajes en este televisor.',
  },
};

/** A message table entry, rendered in every language. */
export function render(table, key, params = {}) {
  return Object.fromEntries(
    Object.entries(table).map(([language, entries]) => {
      const entry = entries[key];
      return [language, typeof entry === 'function' ? entry(params) : entry];
    }),
  );
}

/** Join several rendered messages, language by language. */
export function join(...messages) {
  return Object.fromEntries(
    Object.keys(messages[0]).map((language) => [
      language,
      messages.map((message) => message[language]).join(' '),
    ]),
  );
}
