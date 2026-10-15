// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+, form buttons 5.2+):
// `tv_message`, a message on the TV from the dashboard.
//
// - a status line: is the TV reachable (on, its app answering);
// - "Write a message": a form behind the button (Gladys 5.2.0, #3168), the
//   typed message appears on the TV — "Dinner is ready!" from the kitchen
//   tablet to the living room;
// - up to three quick messages, written once in the widget settings, one tap
//   each.
//
// Budget (8 components, 4 buttons): one status, four buttons at most, one
// text when there is nothing to show. Button keys are distinct (`write`,
// `quick_1`…): the core drops a button whose action key is already taken. The
// TV travels in `params`, which the core echoes from the content, never from
// the request. No `primary` style: invisible in dark mode (#3153).
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { WIDGET_KEY } from './monitor.js';
import { NOTIFY_ERRORS, render } from './messages.js';

export const TTL_SECONDS = 60;
export const QUICK_KEYS = ['quick_1', 'quick_2', 'quick_3'];
export const WRITE_DURATIONS = ['5', '10', '30', '60'];
const MAX_BUTTON_LABEL = 24;

export const TEXT = {
  empty: {
    en: 'No TV yet: add one in the configuration of the Notifications Android/Fire TV integration.',
    fr: "Aucune TV pour l'instant : ajoutez-en une dans la configuration de l'intégration Notifications Android/Fire TV.",
    de: 'Noch kein Fernseher: Füge einen in der Konfiguration der Integration Notifications Android/Fire TV hinzu.',
    es: 'Aún no hay televisores: añada uno en la configuración de la integración Notifications Android/Fire TV.',
  },
  gone: {
    en: 'This TV is no longer in the list of the integration.',
    fr: "Cette TV n'est plus dans la liste de l'intégration.",
    de: 'Dieser Fernseher ist nicht mehr in der Liste der Integration.',
    es: 'Este televisor ya no está en la lista de la integración.',
  },
  noText: {
    en: 'This quick message is empty: write it in the widget settings.',
    fr: 'Ce message rapide est vide : écrivez-le dans les réglages du widget.',
    de: 'Diese Schnellnachricht ist leer: Schreib sie in den Einstellungen des Widgets.',
    es: 'Este mensaje rápido está vacío: escríbalo en los ajustes del widget.',
  },
  reachable: {
    en: 'On, reachable',
    fr: 'Allumée, joignable',
    de: 'An, erreichbar',
    es: 'Encendido',
  },
  unreachable: {
    en: 'Off or unreachable',
    fr: 'Éteinte ou injoignable',
    de: 'Aus oder nicht erreichbar',
    es: 'Apagado o inaccesible',
  },
  unknown: {
    en: 'Not checked yet',
    fr: 'Pas encore testée',
    de: 'Noch nicht geprüft',
    es: 'Aún sin comprobar',
  },
  write: {
    en: 'Write a message',
    fr: 'Écrire un message',
    de: 'Nachricht schreiben',
    es: 'Escribir un mensaje',
  },
  message: { en: 'Message', fr: 'Message', de: 'Nachricht', es: 'Mensaje' },
  duration: {
    en: 'Display time',
    fr: "Durée d'affichage",
    de: 'Anzeigedauer',
    es: 'Duración en pantalla',
  },
  seconds: { en: 'seconds', fr: 'secondes', de: 'Sekunden', es: 'segundos' },
  shown: {
    en: 'Message shown on ',
    fr: 'Message affiché sur ',
    de: 'Nachricht angezeigt auf ',
    es: 'Mensaje mostrado en ',
  },
};

const t = (text, language) => text[language] ?? text.en;

const truncate = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

/** The quick messages written in the settings, by key (empty ones left out). */
function quickMessages(settings) {
  return QUICK_KEYS.map((key) => ({
    key,
    text: typeof settings?.[key] === 'string' ? settings[key].trim() : '',
  })).filter((quick) => quick.text);
}

/** The TV of a widget instance: the chosen one, else the first created TV. */
function selectedTv(monitor, settings) {
  const created = monitor.createdTvs();
  const chosen = typeof settings?.device === 'string' && settings.device ? settings.device : null;
  if (!chosen) {
    return { tv: created[0] ?? null, gone: false };
  }
  const tv = created.find((candidate) => monitor.deviceIdOf(candidate) === chosen) ?? null;
  return { tv, gone: tv === null };
}

/** Status row value of a TV (40 characters at most). */
export function statusValue(view, language) {
  if (view.reachable === true) {
    return { value: t(TEXT.reachable, language), color: WIDGET_COLORS.SUCCESS };
  }
  if (view.reachable === false) {
    return { value: t(TEXT.unreachable, language), color: WIDGET_COLORS.DANGER };
  }
  return { value: t(TEXT.unknown, language), color: WIDGET_COLORS.NEUTRAL };
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    async get(monitor, { settings, language = 'en' }) {
      const { tv, gone } = selectedTv(monitor, settings);
      if (!tv) {
        return {
          ttl_seconds: TTL_SECONDS,
          components: [
            { type: 'text', variant: 'body', text: t(gone ? TEXT.gone : TEXT.empty, language) },
          ],
        };
      }
      const view = monitor.view(tv);
      const components = [
        {
          type: 'status',
          items: [{ label: truncate(tv.name, 40), icon: 'tv', ...statusValue(view, language) }],
        },
        {
          type: 'button',
          label: t(TEXT.write, language),
          icon: 'edit-3',
          style: 'secondary',
          action: {
            key: 'write',
            params: { tv: tv.id },
            fields: [
              { key: 'message', type: 'string', required: true, label: TEXT.message },
              {
                key: 'duration',
                type: 'select',
                required: true,
                default: '10',
                label: TEXT.duration,
                options: WRITE_DURATIONS.map((value) => ({
                  value,
                  label: Object.fromEntries(
                    Object.entries(TEXT.seconds).map(([lang, unit]) => [lang, `${value} ${unit}`]),
                  ),
                })),
              },
            ],
          },
        },
      ];
      for (const quick of quickMessages(settings)) {
        components.push({
          type: 'button',
          label: truncate(quick.text, MAX_BUTTON_LABEL),
          icon: 'message-square',
          style: 'secondary',
          action: { key: quick.key, params: { tv: tv.id } },
        });
      }
      return { ttl_seconds: TTL_SECONDS, components };
    },

    async action(monitor, { actionKey, params, settings, values }) {
      const tv = monitor.tvs.get(params?.tv);
      if (!tv) {
        return TEXT.gone;
      }
      let fields;
      if (actionKey === 'write') {
        // An older core drops the form and relays the tap without `values`.
        if (typeof values?.message !== 'string' || !values.message.trim()) {
          return render(NOTIFY_ERRORS, 'empty');
        }
        fields = { message: values.message, duration: values.duration ?? '10', icon: 'info' };
      } else {
        const quick = quickMessages(settings).find((entry) => entry.key === actionKey);
        if (!quick) {
          return TEXT.noText;
        }
        fields = { message: quick.text, icon: 'info' };
      }
      const result = await monitor.notify(tv, fields);
      if (!result.sent) {
        return render(NOTIFY_ERRORS, result.error, { name: tv.name, status: result.status });
      }
      return Object.fromEntries(
        Object.entries(TEXT.shown).map(([language, start]) => [language, `${start}${tv.name}`]),
      );
    },
  },
};
