using Mirror;
using UnityEngine;

[RequireComponent(typeof(NetworkIdentity))]
[RequireComponent(typeof(NetworkTransformReliable))]
[RequireComponent(typeof(RuntimeParticipant))]
public class RuntimeParticipantInstaller : MonoBehaviour
{
    private void Reset()
    {
        ConfigureNetworking();
    }

    private void Awake()
    {
        ConfigureNetworking();
    }

    private void ConfigureNetworking()
    {
        NetworkIdentity identity =
            GetComponent<NetworkIdentity>();

        NetworkTransformReliable transformSync =
            GetComponent<NetworkTransformReliable>();

        // Standardized runtime conventions
        identity.serverOnly = false;

        transformSync.syncDirection =
            SyncDirection.ClientToServer;

        Debug.Log("[INSTALLER] Runtime Participant Configured");
    }
}