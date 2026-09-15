import { NativeTabs } from 'expo-router/unstable-native-tabs';

export default function TabsLayout() {
  return (
    <NativeTabs
      backgroundColor="#FFFDF8"
      tintColor="#B98220"
      iconColor={{ default: '#71756F', selected: '#B98220' }}
      labelStyle={{ default: { color: '#71756F' }, selected: { color: '#B98220' } }}
      labelVisibilityMode="labeled"
      disableTransparentOnScrollEdge
      backBehavior="initialRoute"
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md={{ default: 'home', selected: 'home' }} />
        <NativeTabs.Trigger.Label>الرئيسية</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="discover">
        <NativeTabs.Trigger.Icon sf={{ default: 'magnifyingglass', selected: 'magnifyingglass' }} md={{ default: 'search', selected: 'search' }} />
        <NativeTabs.Trigger.Label>اكتشف</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="bookings">
        <NativeTabs.Trigger.Icon sf={{ default: 'calendar', selected: 'calendar' }} md={{ default: 'calendar_month', selected: 'calendar_month' }} />
        <NativeTabs.Trigger.Label>حجوزاتي</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat">
        <NativeTabs.Trigger.Icon sf={{ default: 'message', selected: 'message.fill' }} md={{ default: 'chat_bubble_outline', selected: 'chat_bubble' }} />
        <NativeTabs.Trigger.Label>المحادثات</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} md={{ default: 'person_outline', selected: 'person' }} />
        <NativeTabs.Trigger.Label>حسابي</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
