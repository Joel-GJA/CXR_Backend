using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;

[AddComponentMenu("CXR Multiplayer/Runtime Scene Singleton Guard")]
[DisallowMultipleComponent]
public sealed class RuntimeSceneSingletonGuard : MonoBehaviour
{
    [SerializeField]
    private bool enforceEventSystem = true;

    [SerializeField]
    private bool createEventSystemIfMissing = true;

    [SerializeField]
    private bool enforceAudioListener = true;

    [SerializeField]
    private bool createAudioListenerIfMissing = true;

    private void OnEnable()
    {
        SceneManager.sceneLoaded += HandleSceneLoaded;
        EnforceSingletons();
    }

    private void OnDisable()
    {
        SceneManager.sceneLoaded -= HandleSceneLoaded;
    }

    private void Update()
    {
        EnforceSingletons();
    }

    private void HandleSceneLoaded(Scene scene, LoadSceneMode mode)
    {
        EnforceSingletons();
    }

    private void EnforceSingletons()
    {
        if (enforceEventSystem)
        {
            EnforceEventSystem();
        }

        if (enforceAudioListener)
        {
            EnforceAudioListener();
        }
    }

    private void EnforceEventSystem()
    {
        EventSystem[] eventSystems = FindObjectsOfType<EventSystem>(true);
        EventSystem keeper = null;

        for (int index = 0; index < eventSystems.Length; index++)
        {
            EventSystem candidate = eventSystems[index];
            if (candidate == null)
            {
                continue;
            }

            if (keeper == null && candidate.gameObject.activeInHierarchy)
            {
                keeper = candidate;
                continue;
            }

            candidate.gameObject.SetActive(false);
        }

        if (keeper != null || !createEventSystemIfMissing)
        {
            return;
        }

        GameObject eventSystemObject = new GameObject("EventSystem");
        eventSystemObject.AddComponent<EventSystem>();
        eventSystemObject.AddComponent<StandaloneInputModule>();
    }

    private void EnforceAudioListener()
    {
        AudioListener[] listeners = FindObjectsOfType<AudioListener>(true);
        AudioListener keeper = null;

        for (int index = 0; index < listeners.Length; index++)
        {
            AudioListener candidate = listeners[index];
            if (candidate == null)
            {
                continue;
            }

            if (keeper == null && candidate.gameObject.activeInHierarchy)
            {
                keeper = candidate;
                candidate.enabled = true;
                continue;
            }

            candidate.enabled = false;
        }

        if (keeper != null || !createAudioListenerIfMissing)
        {
            return;
        }

        Camera camera = Camera.main;
        if (camera != null)
        {
            camera.gameObject.AddComponent<AudioListener>();
            return;
        }

        GameObject listenerObject = new GameObject("Runtime Audio Listener");
        listenerObject.AddComponent<AudioListener>();
    }
}
