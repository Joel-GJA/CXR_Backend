using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit;
using UnityEngine.XR.Interaction.Toolkit.Attachment;

[RequireComponent(typeof(XRGrabInteractable), typeof(RuntimeInteractable))]
public class XRInteractableBridge : MonoBehaviour
{
    private XRGrabInteractable xrGrab;
    private RuntimeInteractable runtimeInteractable;
    private AttachPointVelocityTracker velocityTracker;
    private bool wasSelected;

    private void Awake()
    {
        xrGrab = GetComponent<XRGrabInteractable>();
        runtimeInteractable = GetComponent<RuntimeInteractable>();
        velocityTracker = new AttachPointVelocityTracker();

        if (Application.isBatchMode)
            enabled = false;
    }

    private void OnEnable()
    {
        xrGrab.selectEntered.AddListener(OnGrab);
        xrGrab.selectExited.AddListener(OnRelease);
    }

    private void OnDisable()
    {
        xrGrab.selectEntered.RemoveListener(OnGrab);
        xrGrab.selectExited.RemoveListener(OnRelease);
    }

    private void Update()
    {
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
        runtimeInteractable.LocalTryGrab();
    }

    private void OnRelease(SelectExitEventArgs args)
    {
        Vector3 velocity = velocityTracker.GetAttachPointVelocity();
        Vector3 angularVelocity = velocityTracker.GetAttachPointAngularVelocity();
        runtimeInteractable.LocalTryRelease(
            transform.position,
            transform.rotation,
            velocity,
            angularVelocity);
    }
}
