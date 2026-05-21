using UnityEngine;
using CXR.SDK.Discovery;

namespace CXR.SDK.Samples.RoomBrowserExample
{
    public sealed class SampleRoomBrowserBootstrap : MonoBehaviour
    {
        [SerializeField] private DiscoveryManager discoveryManager;

        private void Start()
        {
            if (discoveryManager == null)
                discoveryManager = FindObjectOfType<DiscoveryManager>();

            if (discoveryManager == null)
                return;

            discoveryManager.Initialize();
            discoveryManager.RefreshRooms();
        }
    }
}
