  const notifScore = useMemo(() => {
    if (!s) return null;
    const toggles = [s.eventReminders, s.conflictAlerts, s.partnerUpdates, s.familyUpdates, s.weeklySummary];
    const on = toggles.filter(Boolean).length;
    return { on, total: toggles.length, quiet: s.quietHoursEnabled };
  }, [s]);
