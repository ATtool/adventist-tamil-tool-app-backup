import * as Notifications from 'expo-notifications';

// 1. Tell the app how to behave if a notification arrives while the user is actively using the app
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// 2. Function to politely ask the Android/iOS operating system for permission to send alerts
export async function requestNotificationPermissions() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  // If we haven't asked yet, ask now
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  return finalStatus === 'granted';
}

// 3. The main engine: This takes the downloaded Manna data and sets the 4 AM alarms
export async function scheduleMannaNotifications(mannaData) {
  if (!mannaData) return;

  // RULE A: Clean the slate. We cancel all old alarms first so we don't accidentally send two notifications on the same day.
  await Notifications.cancelAllScheduledNotificationsAsync();

  // RULE B: Check if the user allowed us to send notifications
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    console.log("User denied notification permissions.");
    return;
  }

  // RULE C: Look ahead. We will set alarms for Today + the next 6 days (7 days total).
  // This keeps the app completely offline-first. Even if they don't open the app for a week, it will keep ringing.
  const today = new Date();
  
  for (let i = 0; i < 7; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + i);

    // Format the date to perfectly match your JSON keys (YYYY-MM-DD)
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    // Grab the devotion for this specific date
    const devotion = mannaData[dateString];

    if (devotion && devotion.title) {
      // Set the alarm clock exactly to 4:00 AM for this date
      const trigger = new Date(targetDate);
      trigger.setHours(4, 0, 0, 0); 

      // RULE D: Only set the alarm if 4:00 AM hasn't passed yet for that day
      if (trigger > new Date()) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "🌻 இன்றைய மன்னா", // "Today's Manna"
            body: `${devotion.title} - வாசிக்க இங்கே கிளிக் செய்யவும்.`, // "Title - Click here to read"
            sound: true,
            // The 'data' payload is invisible to the user. We will use this in Step 3 to automatically jump to the screen.
            data: { screen: 'TodaysManna', date: dateString }, 
          },
          trigger,
        });
      }
    }
  }
  console.log("Successfully scheduled 4 AM offline alarms for upcoming devotions.");
}
