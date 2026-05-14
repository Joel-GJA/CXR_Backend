using UnityEngine;
using CXR.SDK;

namespace CXR.SDK.Samples.RoomBrowserExample
{
    public sealed class SampleRoomBrowserBootstrap : MonoBehaviour
    {
        private void Start()
        {
            CXRSDK.Initialize();
            CXRSDK.RefreshRooms();
        }
    }
}
