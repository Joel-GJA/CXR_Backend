using UnityEngine;
using CXR.SDK.Discovery;

namespace CXR.SDK.Samples.RoomBrowserExample
{
    public sealed class SampleRoomServerMetadata : MonoBehaviour
    {
        [SerializeField] private DiscoveryBroadcaster discoveryBroadcaster;
        [SerializeField] private string advertisedRoomName = "XR Classroom";
        [SerializeField] private string advertisedStatus = "Open";
        [SerializeField] private string environmentName = "Lab-A";
        [SerializeField] private string scenarioName = "Collaborative Session";

        private void Awake()
        {
            if (discoveryBroadcaster == null)
            {
                discoveryBroadcaster = GetComponent<DiscoveryBroadcaster>();
            }

            if (discoveryBroadcaster == null)
            {
                return;
            }

            discoveryBroadcaster.RoomName = advertisedRoomName;
            discoveryBroadcaster.Status = advertisedStatus;
            discoveryBroadcaster.SetMetadata("environment", environmentName);
            discoveryBroadcaster.SetMetadata("scenario", scenarioName);
        }
    }
}
