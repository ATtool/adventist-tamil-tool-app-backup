import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

export async function scheduleMannaNotifications(mannaData) {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    console.log("User denied notification permissions.");
    return;
  }

  const today = new Date();

  for (let i = 0; i < 7; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + i);

    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    const devotion = mannaData ? mannaData[dateString] : null;

    const trigger = new Date(targetDate);
    trigger.setHours(4, 30, 0, 0);

    if (trigger > new Date()) {
      const body = devotion && devotion.title
        ? `${devotion.title} - இன்றைய மன்னா (${dateString})`
        : `இன்றைய மன்னாவை வாசிக்க (${dateString})`;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🌻 இன்றைய மன்னா",
          body,
          sound: true,
          data: { screen: 'TodaysManna', date: dateString },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: trigger,
        },
      });
    }
  }
  console.log("Scheduled 4:30 AM offline alarms for upcoming devotions.");
}
