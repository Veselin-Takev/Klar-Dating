import { createElement as h, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { randomUUID } from 'node:crypto';
import type { SupportedLanguage } from '../i18n/locale';
import { createRequestI18n } from '../i18n/server';

/** React's HTML serializer escapes every text/attribute value. No raw HTML sink. */
function page(language: SupportedLanguage, title: string, content: ReactNode) {
  return '<!doctype html>' + renderToStaticMarkup(h('html', {lang: language},
    h('head', null, h('meta', {charSet: 'utf-8'}), h('meta', {name: 'viewport', content: 'width=device-width, initial-scale=1'}),
      h('title', null, title, ' · Klar'), h('link', {rel: 'stylesheet', href: '/contracts.css'})),
    h('body', null, h('main', null, h('h1', null, title), content))));
}
export function renderContractForm(language: SupportedLanguage, kind: 'cancel' | 'withdraw') {
  const { t } = createRequestI18n(language);
  const field = (name: string, label: string, type: string, required: boolean, maxLength: number) =>
    h('p', {key: name}, h('label', {htmlFor: name}, label), h('br'), h('input', {id: name, name, type, maxLength, required}));
  return page(language, t(kind === 'cancel' ? 'contracts.cancelLink' : 'contracts.withdrawLink'), [
    h('nav', {key: 'nav', 'aria-label': t('settings.language')}, ...['de', 'en', 'es', 'fr'].map(lang => h('a', {key: lang, href: '?lang=' + lang, lang}, lang.toUpperCase(), ' '))),
    h('p', {key: 'intro'}, t('contracts.intro')),
    h('form', {key: 'form', method: 'post', action: '/vertraege/erklaerung'},
      h('input', {type: 'hidden', name: 'requestId', value: randomUUID()}), h('input', {type: 'hidden', name: 'kind', value: kind}), h('input', {type: 'hidden', name: 'language', value: language}),
      field('name', t('contracts.name'), 'text', true, 200), field('email', t('contracts.email'), 'email', true, 254), field('contract', t('contracts.contract'), 'text', true, 200),
      kind === 'cancel' ? [h('p', {key: 'type'}, h('label', {htmlFor: 'cancellationType'}, t('contracts.cancellationType')), h('br'),
        h('select', {id: 'cancellationType', name: 'cancellationType'}, h('option', {value: 'ordinary'}, t('contracts.ordinary')), h('option', {value: 'extraordinary'}, t('contracts.extraordinary')))),
        field('requestedEnd', t('contracts.requestedEnd'), 'date', false, 10), h('p', {key: 'earliest'}, t('contracts.earliest'))] : null,
      h('p', null, h('label', {htmlFor: 'reason'}, t('contracts.reason')), h('br'), h('textarea', {id: 'reason', name: 'reason', maxLength: 2000})),
      h('button', {type: 'submit'}, t(kind === 'cancel' ? 'contracts.confirmCancel' : 'contracts.confirmWithdraw'))),
  ]);
}
export function renderContractError(language: SupportedLanguage, invalid = false) {
  const {t} = createRequestI18n(language);
  return page(language, t('contracts.error'), [h('p', {key:'error', role:'alert'}, t(invalid ? 'contracts.invalid' : 'contracts.unavailable')),
    invalid ? h('p', {key:'back'}, t('contracts.back')) : null]);
}
export function renderContractReceipt(language: SupportedLanguage, receipt: {id: string; text: string}) {
  const {t} = createRequestI18n(language);
  return page(language, t('contracts.receipt'), [h('p', {key:'note'}, t('contracts.receiptNote')), h('pre', {key:'receipt'}, receipt.text),
    h('a', {key:'download', download: `Klar-${receipt.id}.txt`, href: 'data:text/plain;charset=utf-8,' + encodeURIComponent(receipt.text)}, t('contracts.download'))]);
}
