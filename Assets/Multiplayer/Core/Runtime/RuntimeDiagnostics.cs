using UnityEngine;

[DisallowMultipleComponent]
public class RuntimeDiagnostics : MonoBehaviour
{
    [SerializeField]
    private RuntimeSessionManager sessionManager;

    [SerializeField]
    private bool logStateChanges = true;

    [SerializeField]
    private bool logParticipantChanges = true;

    [SerializeField]
    private float refreshIntervalSeconds = 0.5f;

    [Header("Runtime Snapshot")]
    [SerializeField]
    private RuntimeSessionState sessionState =
        RuntimeSessionState.WaitingForParticipants;

    [SerializeField]
    private int activeParticipantCount;

    [SerializeField]
    private int trackedParticipantCount;

    private RuntimeSessionManager subscribedManager;
    private float nextRefreshTime;

    private void OnEnable()
    {
        ResolveSessionManager();
        Subscribe();
        RefreshSnapshot();
    }

    private void OnDisable()
    {
        Unsubscribe();
    }

    private void Update()
    {
        if (Time.unscaledTime < nextRefreshTime)
        {
            return;
        }

        nextRefreshTime =
            Time.unscaledTime + Mathf.Max(0.1f, refreshIntervalSeconds);

        ResolveSessionManager();
        Subscribe();
        RefreshSnapshot();
    }

    public void PrintRuntimeSnapshot()
    {
        RefreshSnapshot();

        Debug.Log(
            $"[RUNTIME DIAGNOSTICS] " +
            $"State={sessionState} | " +
            $"ActiveParticipants={activeParticipantCount} | " +
            $"TrackedParticipants={trackedParticipantCount}");
    }

    private void ResolveSessionManager()
    {
        if (sessionManager != null)
        {
            return;
        }

        sessionManager =
            RuntimeSessionManager.Instance ??
            FindObjectOfType<RuntimeSessionManager>();
    }

    private void Subscribe()
    {
        if (sessionManager == null || subscribedManager == sessionManager)
        {
            return;
        }

        Unsubscribe();

        subscribedManager = sessionManager;
        subscribedManager.StateChanged += OnSessionStateChanged;
        subscribedManager.ParticipantRegistered += OnParticipantRegistered;
        subscribedManager.ParticipantUnregistered += OnParticipantUnregistered;
    }

    private void Unsubscribe()
    {
        if (subscribedManager == null)
        {
            return;
        }

        subscribedManager.StateChanged -= OnSessionStateChanged;
        subscribedManager.ParticipantRegistered -= OnParticipantRegistered;
        subscribedManager.ParticipantUnregistered -= OnParticipantUnregistered;
        subscribedManager = null;
    }

    private void RefreshSnapshot()
    {
        if (sessionManager == null)
        {
            sessionState = RuntimeSessionState.WaitingForParticipants;
            activeParticipantCount = 0;
            trackedParticipantCount = 0;
            return;
        }

        sessionState = sessionManager.State;
        activeParticipantCount = sessionManager.ParticipantCount;
        trackedParticipantCount = sessionManager.ParticipantInfos.Count;
    }

    private void OnSessionStateChanged(
        RuntimeSessionState previousState,
        RuntimeSessionState nextState)
    {
        RefreshSnapshot();

        if (!logStateChanges)
        {
            return;
        }

        Debug.Log(
            $"[RUNTIME DIAGNOSTICS] Session State | " +
            $"{previousState} -> {nextState}");
    }

    private void OnParticipantRegistered(RuntimeParticipant participant)
    {
        RefreshSnapshot();

        if (!logParticipantChanges || participant == null)
        {
            return;
        }

        Debug.Log(
            $"[RUNTIME DIAGNOSTICS] Participant Joined | " +
            $"NetID={participant.netId} | " +
            $"ActiveParticipants={activeParticipantCount}");
    }

    private void OnParticipantUnregistered(RuntimeParticipant participant)
    {
        RefreshSnapshot();

        if (!logParticipantChanges || participant == null)
        {
            return;
        }

        Debug.Log(
            $"[RUNTIME DIAGNOSTICS] Participant Left | " +
            $"NetID={participant.netId} | " +
            $"ActiveParticipants={activeParticipantCount}");
    }
}
