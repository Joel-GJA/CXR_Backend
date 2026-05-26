using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit;
using UnityEngine.XR.Interaction.Toolkit.Attachment;
using UnityEngine.XR.Interaction.Toolkit.Filtering;

[RequireComponent(typeof(XRGrabInteractable), typeof(RuntimeInteractable))]
public class XRInteractableBridge : MonoBehaviour
{
    private const float PendingGrabTimeoutSeconds = 0.35f;

    private XRGrabInteractable xrGrab;
    private RuntimeInteractable runtimeInteractable;
    private AttachPointVelocityTracker velocityTracker;
    private XRSelectFilterDelegate selectFilter;
    private bool wasSelected;
    private bool pendingGrabValidation;
    private float pendingGrabTimeoutAt;

    private void Awake()
    {
        xrGrab = GetComponent<XRGrabInteractable>();
        runtimeInteractable = GetComponent<RuntimeInteractable>();
        velocityTracker = new AttachPointVelocityTracker();
        selectFilter = new XRSelectFilterDelegate(CanSelectInteractable);

        if (Application.isBatchMode)
            enabled = false;
    }

    private void OnEnable()
    {
        xrGrab.selectFilters.Add(selectFilter);
        xrGrab.selectEntered.AddListener(OnGrab);
        xrGrab.selectExited.AddListener(OnRelease);
    }

    private void OnDisable()
    {
        xrGrab.selectFilters.Remove(selectFilter);
        xrGrab.selectEntered.RemoveListener(OnGrab);
        xrGrab.selectExited.RemoveListener(OnRelease);
    }

    private void Update()
    {
        if (pendingGrabValidation)
        {
            if (runtimeInteractable.isOwned)
            {
                pendingGrabValidation = false;
            }
            else if (runtimeInteractable.IsHeldByAnotherClient ||
                     Time.time >= pendingGrabTimeoutAt)
            {
                CancelLocalSelection();
            }
        }

        if (xrGrab.isSelected)
        {
            if (!wasSelected)
            {
                velocityTracker = new AttachPointVelocityTracker();
                wasSelected = true;
            }
            velocityTracker.UpdateAttachPointVelocityData(transform);
        }
        else
        {
            wasSelected = false;
        }
    }

    private void OnGrab(SelectEnterEventArgs args)
    {
        if (!runtimeInteractable.LocalTryGrab())
        {
            CancelLocalSelection();
            return;
        }

        pendingGrabValidation = !runtimeInteractable.isOwned;
        pendingGrabTimeoutAt = Time.time + PendingGrabTimeoutSeconds;
    }

    private void OnRelease(SelectExitEventArgs args)
    {
        pendingGrabValidation = false;

        Vector3 velocity = velocityTracker.GetAttachPointVelocity();
        Vector3 angularVelocity = velocityTracker.GetAttachPointAngularVelocity();
        runtimeInteractable.LocalTryRelease(
            transform.position,
            transform.rotation,
            velocity,
            angularVelocity);
    }

    private bool CanSelectInteractable(
        IXRSelectInteractor interactor,
        IXRSelectInteractable interactable)
    {
        return runtimeInteractable != null &&
            !runtimeInteractable.IsHeldByAnotherClient;
    }

    private void CancelLocalSelection()
    {
        pendingGrabValidation = false;

        if (xrGrab.interactionManager == null || !xrGrab.isSelected)
        {
            return;
        }

        xrGrab.interactionManager.CancelInteractableSelection(xrGrab);
    }
}
