using Mirror;
using UnityEngine;

public class RuntimeInteractableTester : MonoBehaviour
{
    [Header("Controls")]
    [SerializeField]
    private KeyCode grabKey = KeyCode.P;

    [SerializeField]
    private KeyCode releaseKey = KeyCode.R;

    [SerializeField]
    private float interactRange = 5f;

    [Header("Follow")]
    [SerializeField]
    private float followSpeed = 15f;

    [SerializeField]
    private Vector3 holdOffset = new Vector3(0f, 1.2f, 2f);

    private RuntimeInteractable currentTarget;
    private RuntimeInteractable heldObject;
    private NetworkIdentity netIdentity;

    private void Awake()
    {
        netIdentity = GetComponent<NetworkIdentity>();
        Debug.Log($"[TESTER] Awake | netIdentity={netIdentity != null}");
    }

    private bool statusLogged;

    private void Update()
    {
        if (!NetworkClient.isConnected)
        {
            if (!statusLogged) { Debug.Log("[TESTER] Not connected"); statusLogged = true; }
            return;
        }
        if (netIdentity == null)
        {
            if (!statusLogged) { Debug.Log("[TESTER] netIdentity null"); statusLogged = true; }
            return;
        }
        if (!netIdentity.isOwned)
        {
            if (!statusLogged) { Debug.Log("[TESTER] Not owned"); statusLogged = true; }
            return;
        }
        statusLogged = false;

        FindTarget();
        HandleInput();
        UpdateHeldObject();
    }

    private void FindTarget()
    {
        Vector3 origin = transform.position + Vector3.up * 1f;
        Vector3 direction = transform.forward;

        if (Physics.Raycast(origin, direction, out RaycastHit hit, interactRange))
        {
            RuntimeInteractable interactable = hit.collider.GetComponentInParent<RuntimeInteractable>();
            currentTarget = interactable;
        }
        else
        {
            currentTarget = null;
        }
    }

    private void HandleInput()
    {
        if (Input.GetKeyDown(grabKey) && currentTarget != null && heldObject == null)
        {
            Debug.Log($"[TESTER] Grabbing | Target={currentTarget.name}");
            currentTarget.LocalTryGrab();
            heldObject = currentTarget;
        }

        if (Input.GetKeyDown(releaseKey) && heldObject != null)
        {
            Debug.Log($"[TESTER] Releasing | Target={heldObject.name}");
            heldObject.LocalTryRelease(heldObject.transform.position, Vector3.zero, Vector3.zero);
            heldObject = null;
        }
    }

    private void UpdateHeldObject()
    {
        if (heldObject == null || !heldObject.IsGrabbed || !heldObject.isOwned)
        {
            if (heldObject != null && !heldObject.IsGrabbed)
                heldObject = null;
            return;
        }

        Vector3 targetPosition = transform.position + transform.TransformDirection(holdOffset);
        heldObject.transform.position = Vector3.Lerp(
            heldObject.transform.position, targetPosition, followSpeed * Time.deltaTime);
    }

    private void OnDrawGizmos()
    {
        if (netIdentity == null)
            return;

        Vector3 origin = transform.position + Vector3.up * 1f;
        Vector3 direction = transform.forward;

        Gizmos.color = currentTarget != null ? Color.green : Color.red;
        Gizmos.DrawRay(origin, direction * interactRange);
    }
}
