export const demoCallLogs = [
  {
    id: 'demo-call-001',
    callId: 'demo-call-001',
    agentId: 'agent-enrollment',
    agentName: 'Enrollment Concierge',
    contactName: 'Maya Patel',
    contactId: 'contact-maya',
    callType: 'inbound',
    duration: 342,
    createdAt: '2026-05-24T15:16:00.000Z',
    summary:
      'Caller wanted pricing and availability. Agent answered pricing but did not ask for a preferred appointment time.',
    transcript: `Agent: Hi, thanks for calling BrightPath Dental. How can I help today?
Caller: I saw your ad and wanted to know the price for a cleaning.
Agent: Cleanings start at $99 for new patients.
Caller: Okay, do you have appointments this week?
Agent: We are open Monday through Friday. You can call back when you are ready.
Caller: Alright, thank you.`,
    executedCallActions: []
  },
  {
    id: 'demo-call-002',
    callId: 'demo-call-002',
    agentId: 'agent-enrollment',
    agentName: 'Enrollment Concierge',
    contactName: 'Jordan Lee',
    contactId: 'contact-jordan',
    callType: 'outbound',
    duration: 488,
    createdAt: '2026-05-24T18:42:00.000Z',
    summary:
      'Agent qualified the caller, confirmed the need, booked an appointment, and summarized the next step.',
    transcript: `Agent: Hi Jordan, this is BrightPath following up on your appointment request.
Caller: Yes, I need a consultation this week.
Agent: Great. Are you looking for a first visit or a follow-up?
Caller: First visit.
Agent: I can schedule you for Thursday at 2 PM. Does that work?
Caller: Yes.
Agent: Perfect, you are confirmed for Thursday at 2 PM. You will receive a text confirmation shortly.`,
    executedCallActions: [
      {
        type: 'booking',
        status: 'completed',
        label: 'Appointment booked'
      }
    ]
  },
  {
    id: 'demo-call-003',
    callId: 'demo-call-003',
    agentId: 'agent-support',
    agentName: 'Support Triage Agent',
    contactName: 'Avery Morgan',
    contactId: 'contact-avery',
    callType: 'inbound',
    duration: 271,
    createdAt: '2026-05-23T21:07:00.000Z',
    summary:
      'Caller was upset about a billing issue. Agent gave a generic response but did not escalate or create a follow-up action.',
    transcript: `Agent: Hello, how may I assist you?
Caller: I was charged twice and I am really frustrated.
Agent: I understand.
Caller: Can someone fix this today?
Agent: Billing questions are handled by our office team.
Caller: Can you connect me or have someone call me?
Agent: You can call back later when the office is open.`,
    executedCallActions: []
  }
];
