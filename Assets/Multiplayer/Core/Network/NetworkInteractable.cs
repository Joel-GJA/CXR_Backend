using Mirror;
using UnityEngine;

public class NetworkInteractable : NetworkBehaviour
{
    [SyncVar]
    private uint ownerNetId;

    public bool IsOwned => ownerNetId != 0;

    [Server]
    public void SetOwner(uint newOwnerNetId)
    {
        ownerNetId = newOwnerNetId;
    }

    [Server]
    public void ClearOwner()
    {
        ownerNetId = 0;
    }
}