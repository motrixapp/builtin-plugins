// Pack-time manifest gate.
//
// motrix-turbo's host rejects a plugin at manifest-parse time if the manifest
// violates the manifest schema OR the cross-field invariant "a manifest that
// declares contributes.hooks must declare at least one hostPermissions entry".
// That invariant escaped to a signed release once (motrix.filename-template@
// 1.1.0 shipped hooks with no hostPermissions and was uninstallable on every
// host) because pack.mjs only checked manifest.id vs the directory name and ran
// no real validation. This module is the gate pack.mjs now runs before any
// .moext is produced, so an uninstallable manifest can never be packed, signed,
// or released again.
//
// Validation is composed from the published plugin SDK (@^2.0.0):
//
//   1. @motrix/plugin-manifest-schema's ManifestSchema.parse() — the single
//      source of truth for manifest structure (field shapes, id/version
//      grammar, hostPermissions match-pattern grammar, bounded config schemas,
//      hook roles, ...). Note it validates hook *roles* only; pre-resolve is a
//      valid role here because these are origin: 'builtin' plugins (the
//      builtin-only eligibility of pre-resolve is a host-side rule, not a
//      schema rule, so schema parse accepts it).
//
//   2. the hooks => hostPermissions invariant, which the schema deliberately
//      does NOT encode — it is a cross-field rule the host applies in its own
//      parse.ts (see the HookContributionSchema comment in
//      @motrix/plugin-manifest-schema, which states cross-field hook rules live
//      in parse.ts, not the schema). We replicate the exact rule and canonical
//      error code from @motrix/plugin-cli's `validate-host-permissions`
//      command. That check cannot be imported: @motrix/plugin-cli publishes a
//      bin-only bundle (its commands are inlined into dist/bin, and the package
//      exposes no main/exports), so the logic is reproduced here rather than
//      linked.

import { ManifestSchema } from '@motrix/plugin-manifest-schema'

export const HOST_PERMISSIONS_REQUIRED_FOR_HOOKS =
  'plugin.manifest.host_permissions_required_for_hooks'

/**
 * Validate a parsed motrix-plugin.json object. Throws an Error with a
 * human-readable, id-prefixed message on the first violation; returns the
 * schema-parsed manifest on success.
 *
 * @param {unknown} manifest parsed motrix-plugin.json contents
 * @param {string} [id] plugin id, used only to prefix error messages
 */
export function validateManifest(manifest, id = manifest?.id ?? '<unknown>') {
  let parsed
  try {
    parsed = ManifestSchema.parse(manifest)
  } catch (err) {
    const detail = Array.isArray(err?.issues)
      ? err.issues
          .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
          .join('; ')
      : (err?.message ?? String(err))
    throw new Error(`${id}: invalid motrix-plugin.json — ${detail}`)
  }

  const hooks = parsed.contributes?.hooks
  const hasHooks = hooks != null && Object.keys(hooks).length > 0
  const hostPermissions = Array.isArray(parsed.hostPermissions)
    ? parsed.hostPermissions
    : []
  if (hasHooks && hostPermissions.length === 0) {
    throw new Error(
      `${id}: ${HOST_PERMISSIONS_REQUIRED_FOR_HOOKS}: declared hooks require at least one hostPermissions entry`
    )
  }

  return parsed
}
