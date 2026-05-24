using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit;

[RequireComponent(typeof(XRGrabInteractable), typeof(RuntimeInteractable))]
public class XRInteractableBridge : MonoBehaviour
{
    private XRGrabInteractable xrGrab;
    private RuntimeInteractable runtimeInteractable;

    private void Awake()
    {
        xrGrab = GetComponent<XRGrabInteractable>();
        runtimeInteractable = GetComponent<RuntimeInteractable>();
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

    private void OnGrab(SelectEnterEventArgs args)
    {
        runtimeInteractable.UseFollowOffset = false;
        Debug.Log($"[INTERACTION] XR Grab | Interactable={name} | FollowOffset=OFF");
        runtimeInteractable.LocalTryGrab();
    }

    private void OnRelease(SelectExitEventArgs args)
    {
        Debug.Log($"[INTERACTION] XR Release | Interactable={name} | FollowOffset=ON");
        runtimeInteractable.LocalTryRelease();
        runtimeInteractable.UseFollowOffset = true;
    }
}
