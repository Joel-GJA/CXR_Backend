using Mirror;
using UnityEngine;

namespace CXR.SDK.Samples.RoomBrowserExample
{
    public sealed class SampleHeadlessServerLauncher : MonoBehaviour
    {
        [SerializeField] private NetworkManager networkManager;
        [SerializeField] private bool autoStartInBatchMode = true;

        private void Start()
        {
            if (!autoStartInBatchMode || !Application.isBatchMode)
            {
                return;
            }

            if (networkManager == null)
            {
                networkManager = NetworkManager.singleton;
            }

            if (networkManager != null && !NetworkServer.active)
            {
                networkManager.StartServer();
            }
        }
    }
}
