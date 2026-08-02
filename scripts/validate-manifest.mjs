// Pack-time gate for builtin releases.
//
// motrix-turbo's host rejects a plugin at manifest-parse time if the manifest
// violates the manifest schema OR the cross-field invariant "a manifest that
// declares contributes.hooks must declare at least one hostPermissions entry".
// That invariant escaped to a signed release once (motrix.filename-template@
// 1.1.0 shipped hooks with no hostPermissions and was uninstallable on every
// host) because pack.mjs only checked manifest.id vs the directory name and ran
// no real validation.
//
// The rules themselves now live in @motrix/plugin-manifest-schema (see its
// validate.ts) and are shared verbatim with @motrix/plugin-cli, so the two
// publishing pipelines cannot drift apart again. They previously had: this repo
// carried the hooks invariant but no locale check, while the CLI had the locale
// check and ran the hooks invariant only from a separate subcommand nobody was
// required to call. This module is now a thin façade adding the filesystem
// access the schema package deliberately avoids.
//
// Note on hook roles: the schema validates role *names* only. `pre-resolve`
// parses fine because builtin-only eligibility is a host-side rule keyed on
// plugin origin, not something a manifest can express.

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { checkLocaleCoverage } from '@motrix/plugin-manifest-schema'

export {
  HOST_PERMISSIONS_REQUIRED_FOR_HOOKS,
  LOCALE_MISSING_EN_US,
  LOCALE_MISSING_KEYS,
  validateManifest,
} from '@motrix/plugin-manifest-schema'

/**
 * Assert every `%key%` the manifest interpolates exists in the plugin's base
 * locale. This was unchecked here until now: pack.mjs copied `locales/` through
 * a helper whose body is wrapped in a bare `catch {}`, so a missing or
 * unreadable catalogue shipped silently and surfaced as a literal `%name%` in
 * the UI.
 *
 * @param {string} pluginDir directory holding motrix-plugin.json
 * @param {object} manifest  schema-parsed manifest
 * @throws Error on a missing base locale or an unresolved placeholder
 */
export async function validateLocaleCoverage(pluginDir, manifest) {
  if (!manifest.l10n) return
  // Unreadable and malformed both mean "no usable en-US.json here".
  let baseLocale = null
  try {
    baseLocale = JSON.parse(
      await readFile(path.join(pluginDir, manifest.l10n, 'en-US.json'), 'utf8')
    )
  } catch {
    baseLocale = null
  }
  checkLocaleCoverage(manifest, baseLocale)
}
