/**
 * ط¨ظٹط§ظ†ط§طھ طھط¬ط±ظٹط¨ظٹط© ط¥ط¶ط§ظپظٹط© (ط§ط®طھظٹط§ط±ظٹط©) â€” طھط¹ظ…ظ„ ظپظˆظ‚ ط§ظ„طھظ‡ظٹط¦ط© ط§ظ„طھظ„ظ‚ط§ط¦ظٹط© ظپظٹ index.ts
 *   bun run packages/kanf/src/seed.ts
 */
import { all, get } from "./db"
import { logActivity, type User } from "./auth"
import { createAgentSession, addMessage } from "./agent"

const owner = get<User>(`SELECT * FROM users WHERE email = 'owner@kanf.dev'`)
if (!owner) {
  console.log("ظ„ط§ ظٹظˆط¬ط¯ ط­ط³ط§ط¨ ظ…ط§ظ„ظƒ â€” ط´ط؛ظ‘ظ„ ط§ظ„ط®ط§ط¯ظ… ط£ظˆظ„ط§ظ‹ ظ„ط¹ظ…ظ„ ط§ظ„طھظ‡ظٹط¦ط© ط§ظ„طھظ„ظ‚ط§ط¦ظٹط©.")
  process.exit(0)
}

if (all(`SELECT id FROM agent_sessions`).length === 0) {
  const sid = createAgentSession(owner, "prj_welcome", "ظ…ط±ط§ط¬ط¹ط© ط§ظ„ظƒظˆط¯ ط§ظ„ط£ظˆظ„ظٹ")
  addMessage(
    sid,
    "user",
    "ط£ط±ظٹط¯ ط±ط¤ظٹط© ط¨ظ†ظٹط© ظ…ظ„ظپ ط§ظ„ظˆط§ط¬ظ‡ط© ط§ظ„ط±ط¦ظٹط³ظٹط© ظپظٹ ظ…ط´ط±ظˆط¹ظٹطŒ ظˆط§ظ‚طھط±ط§ط­ طھط­ط³ظٹظ†ط§طھ ط¹ظ„ظ‰ ط§ظ„ط£ط¯ط§ط،.",
  )
  addMessage(
    sid,
    "assistant",
    [
      "طھط­ظ„ظٹظ„ ط£ظˆظ„ظٹ:",
      "",
      "1. **طھط­ظ…ظٹظ„ ظƒط³ظˆظ„**: ط§ط³طھط®ط¯ظ… `loading=\"lazy\"` ظ„ط¬ظ…ظٹط¹ ط§ظ„طµظˆط± ط®ط§ط±ط¬ ط§ظ„ط´ط§ط´ط©.",
      "2. **طھظ‚ط³ظٹظ… ط§ظ„ط­ط²ظ…ط©**: ط§ظ†ظ‚ظ„ ط§ظ„ط³ظƒط±ط¨طھط§طھ ط§ظ„ط«ظ‚ظٹظ„ط© ط¥ظ„ظ‰ `defer`.",
      "3. **طھظ‚ظ„ظٹظ„ ط§ظ„طھظƒط±ط§ط±**: ط¯ظ…ظ‘ظ† ط£ظ†ظ…ط§ط· CSS ط§ظ„ظ…طھظƒط±ط±ط© ظپظٹ ظ…طھط؛ظٹط±ط§طھ.",
      "",
      "ظ‡ظ„ طھط±ظٹط¯ ط£ظ† ط£ظ†ظپظ‘ط° ظ‡ط°ظ‡ ط§ظ„طھط­ط³ظٹظ†ط§طھطں",
    ].join("\n"),
  )
  logActivity(owner.id, "seed.agent", sid)
  console.log("طھظ… ط¥ظ†ط´ط§ط، ط³ط§ط­ط© ط­ظˆط§ط± طھط¬ط±ظٹط¨ظٹط©.")
} else {
  console.log("ط§ظ„ط¨ظٹط§ظ†ط§طھ ط§ظ„طھط¬ط±ظٹط¨ظٹط© ظ…ظˆط¬ظˆط¯ط© ظ…ط³ط¨ظ‚ط§ظ‹.")
}

console.log(`ط§ظ„ظ…ط³طھط®ط¯ظ…ظˆظ†: ${all(`SELECT id FROM users`).length}`)
console.log(`ط§ظ„ظ…ط´ط§ط±ظٹط¹:   ${all(`SELECT id FROM projects`).length}`)
console.log(`ط§ظ„ط³ط§ط­ط§طھ:    ${all(`SELECT id FROM agent_sessions`).length}`)
console.log(`ط³ط¬ظ„ ط§ظ„ظ†ط´ط§ط·: ${all(`SELECT id FROM activity`).length}`)
