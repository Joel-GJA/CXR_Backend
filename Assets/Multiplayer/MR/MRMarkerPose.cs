using System;
using UnityEngine;

[Serializable]
public struct MRMarkerPose
{
    public string markerId;
    public Vector3 position;
    public Quaternion rotation;
    public bool isValid;

    public MRMarkerPose(
        string markerId,
        Vector3 position,
        Quaternion rotation,
        bool isValid)
    {
        this.markerId = markerId;
        this.position = position;
        this.rotation = rotation;
        this.isValid = isValid;
    }
}
