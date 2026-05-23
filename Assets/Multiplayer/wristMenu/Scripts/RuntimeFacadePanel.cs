using UnityEngine;

public abstract class RuntimeFacadePanel
    : MonoBehaviour
{
    protected XRMultiplayerRuntimeFacade runtimeFacade;

    public virtual void Initialize(
        XRMultiplayerRuntimeFacade facade)
    {
        runtimeFacade = facade;
    }
}