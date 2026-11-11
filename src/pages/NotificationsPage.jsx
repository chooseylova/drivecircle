import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell } from "lucide-react";
import { motion } from "framer-motion";
import NotificationsTab from "../components/NotificationsTab";

export default function NotificationsPage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 mb-6">
        <Bell className="w-5 h-5 text-primary" />
        <h1 className="font-orbitron font-bold text-xl tracking-wide">Notifications</h1>
      </motion.div>
      <NotificationsTab user={user} />
    </div>
  );
}