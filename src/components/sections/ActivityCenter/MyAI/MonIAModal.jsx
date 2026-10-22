import React, { useCallback, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import ActivityModal from "../ActivityModal";
import GameShell from "../GameShell";
import MonIAChat from "./MonIAChat";
import PrivacyPolicy from "./PrivacyPolicy.jsx";
import { MON_IA_INFO } from "./monIaInfo";

// Same screen as the games: the name "Mon IA" on the right (with its "i" button right after it), a short line
// on the left, the chat in the middle, close button on the left. The "i" panel explains Mon IA and links to
// the full Privacy Policy & Terms, which open on top.
// To put the close button on the right instead, change closeSide="left" to closeSide="right".
export default function MonIAModal({ activity, onClose }) {
  const [policyOpen, setPolicyOpen] = useState(false);
  const closePolicy = useCallback(() => setPolicyOpen(false), []);
  const openPolicy = useCallback(() => setPolicyOpen(true), []);
  const info = useMemo(
    () => ({ ...MON_IA_INFO, action: { label: MON_IA_INFO.actionLabel, onClick: openPolicy } }),
    [openPolicy]
  );
  return (
    <>
      <ActivityModal title={activity.name} onClose={onClose} closeSide="left" level={1} variant="game" showHeader={false}>
        <GameShell title={activity.name} tagline="Ask me about Akpos. " info={info}>
          <MonIAChat onOpenPrivacy={openPolicy} />
        </GameShell>
      </ActivityModal>
      <AnimatePresence>
        {policyOpen && (
          <ActivityModal key="privacy" title="Privacy Policy" onClose={closePolicy} level={2}>
            <PrivacyPolicy />
          </ActivityModal>
        )}
      </AnimatePresence>
    </>
  );
}