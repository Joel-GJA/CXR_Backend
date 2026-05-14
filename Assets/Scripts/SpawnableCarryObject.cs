using Mirror;
using UnityEngine;

public class SpawnableCarryObject : NetworkBehaviour
{
    [SerializeField] private float lifetimeSeconds = 60f;
    [SerializeField] private Vector3 holdOffset = new Vector3(0f, 1.2f, 1.5f);
    [SerializeField] private float followSpeed = 20f;

    [SyncVar] private uint ownerNetId;
    [SyncVar] private uint heldByNetId;

    private Rigidbody cachedRigidbody;
    private double destroyAt;

    public uint OwnerNetId => ownerNetId;
    public bool IsHeld => heldByNetId != 0;

    private void Awake()
    {
        cachedRigidbody = GetComponent<Rigidbody>();
    }

    [Server]
    public void Initialize(uint ownerId)
    {
        ownerNetId = ownerId;
        destroyAt = NetworkTime.time + lifetimeSeconds;
        SetHeldState(false);
    }

    [ServerCallback]
    private void Update()
    {
        if (NetworkTime.time >= destroyAt)
        {
            ForceReleaseAndDestroy();
            return;
        }

        if (!IsHeld)
        {
            return;
        }

        SimplePlayerMovement holder = GetHolder();
        if (holder == null)
        {
            Drop();
            return;
        }

        Vector3 targetPosition = holder.transform.position + holder.transform.TransformDirection(holdOffset);

        if (cachedRigidbody != null)
        {
            cachedRigidbody.MovePosition(Vector3.Lerp(transform.position, targetPosition, followSpeed * Time.deltaTime));
            cachedRigidbody.MoveRotation(Quaternion.identity);
            cachedRigidbody.velocity = Vector3.zero;
            cachedRigidbody.angularVelocity = Vector3.zero;
        }
        else
        {
            transform.position = Vector3.Lerp(transform.position, targetPosition, followSpeed * Time.deltaTime);
            transform.rotation = Quaternion.identity;
        }
    }

    [Server]
    public bool TryPickUp(SimplePlayerMovement player)
    {
        if (player == null || IsHeld || ownerNetId != player.netId)
        {
            return false;
        }

        heldByNetId = player.netId;
        SetHeldState(true);
        return true;
    }

    [Server]
    public void Drop()
    {
        heldByNetId = 0;
        SetHeldState(false);
    }

    [Server]
    public void ForceReleaseAndDestroy()
    {
        SimplePlayerMovement holder = GetHolder();
        if (holder != null)
        {
            holder.ServerClearHeldObject(this);
        }

        NetworkServer.Destroy(gameObject);
    }

    [Server]
    private void SetHeldState(bool held)
    {
        if (cachedRigidbody == null)
        {
            return;
        }

        cachedRigidbody.isKinematic = held;
        cachedRigidbody.useGravity = !held;
        cachedRigidbody.velocity = Vector3.zero;
        cachedRigidbody.angularVelocity = Vector3.zero;
    }

    [Server]
    private SimplePlayerMovement GetHolder()
    {
        if (!NetworkServer.spawned.TryGetValue(heldByNetId, out NetworkIdentity holderIdentity))
        {
            return null;
        }

        return holderIdentity.GetComponent<SimplePlayerMovement>();
    }
}
